import "server-only";
import { Prisma } from "@prisma/client";
import type {
  RecommendationActionType,
  RecommendationPriority,
  RecommendationType,
  Role,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/audit/log";
import { NotFound, Conflict } from "@/server/errors";
import { canSeeAllCrm } from "@/server/crm/scope";
import {
  cooldownUntil,
  isInCooldown,
  recommendationDedupeKey,
} from "./recommendation-key";
import { recommendationScopeWhere } from "./scope";

export { recommendationScopeWhere } from "./scope";

/**
 * Persistance des recommandations : déduplication (§36), cooldown (§37),
 * expiration automatique quand le problème est résolu (§38). Une passe
 * d'automatisation relancée n'accumule jamais de doublons.
 */

export type DetectedRecommendation = {
  type: RecommendationType;
  title: string;
  description: string;
  priority: RecommendationPriority;
  entityType?: string | null;
  entityId?: string | null;
  actionType?: RecommendationActionType | null;
  actionPayload?: unknown;
  /** Faits chiffrés (issus des services métier). */
  facts?: unknown;
  /** Commercial concerné → périmètre SALES (§41). null = visible des rôles larges. */
  ownerUserId?: string | null;
  /** Clé de période (jour métier) pour les recommandations récurrentes. */
  periodKey?: string | null;
  /** Heures de refroidissement avant recréation (§37). */
  cooldownHours?: number;
  expiresAt?: Date | null;
};

export type UpsertResult = {
  created: number;
  updated: number;
  skipped: number;
  /** Toutes les dedupeKeys vues dans cette passe (pour l'expiration). */
  seenKeys: string[];
};

const RESURRECTABLE = new Set(["EXPIRED"]);

function asJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return v == null ? Prisma.JsonNull : (v as Prisma.InputJsonValue);
}

export async function upsertRecommendations(
  organizationId: string,
  detected: DetectedRecommendation[],
  opts: { now?: Date; actorUserId?: string | null } = {},
): Promise<UpsertResult> {
  const now = opts.now ?? new Date();
  const res: UpsertResult = { created: 0, updated: 0, skipped: 0, seenKeys: [] };

  for (const d of detected) {
    const dedupeKey = recommendationDedupeKey({
      organizationId,
      type: d.type,
      entityId: d.entityId ?? null,
      periodKey: d.periodKey ?? null,
    });
    res.seenKeys.push(dedupeKey);

    const existing = await prisma.businessRecommendation.findUnique({
      where: { organizationId_dedupeKey: { organizationId, dedupeKey } },
      select: { id: true, status: true, cooldownUntil: true },
    });

    if (existing) {
      if (existing.status === "DISMISSED") {
        res.skipped++; // l'utilisateur a écarté : on ne ressuscite pas tout seul
        continue;
      }
      if (isInCooldown(existing, now)) {
        res.skipped++;
        continue;
      }
      await prisma.businessRecommendation.update({
        where: { id: existing.id },
        data: {
          title: d.title,
          description: d.description,
          priority: d.priority,
          actionType: d.actionType ?? null,
          actionPayload: asJson(d.actionPayload),
          facts: asJson(d.facts),
          ownerUserId: d.ownerUserId ?? null,
          entityType: d.entityType ?? null,
          cooldownUntil: cooldownUntil(now, d.cooldownHours ?? 0),
          expiresAt: d.expiresAt ?? null,
          detectedAt: now,
          ...(RESURRECTABLE.has(existing.status)
            ? { status: "NEW" as const, dismissedAt: null }
            : {}),
        },
      });
      res.updated++;
      continue;
    }

    const created = await prisma.businessRecommendation.create({
      data: {
        organizationId,
        type: d.type,
        title: d.title,
        description: d.description,
        priority: d.priority,
        status: "NEW",
        entityType: d.entityType ?? null,
        entityId: d.entityId ?? null,
        actionType: d.actionType ?? null,
        actionPayload: asJson(d.actionPayload),
        facts: asJson(d.facts),
        ownerUserId: d.ownerUserId ?? null,
        dedupeKey,
        cooldownUntil: cooldownUntil(now, d.cooldownHours ?? 0),
        expiresAt: d.expiresAt ?? null,
        detectedAt: now,
      },
      select: { id: true },
    });
    res.created++;
    await writeAuditLog({
      action: "RECOMMENDATION_CREATED",
      entityType: "business_recommendation",
      entityId: created.id,
      organizationId,
      actorUserId: opts.actorUserId ?? null,
      metadata: { type: d.type, priority: d.priority, entityId: d.entityId ?? null },
    });
  }

  return res;
}

/**
 * Marque EXPIRED les recommandations actives des `types` traités dont le
 * problème n'a PAS été redétecté dans cette passe (§38, §62). N'expire jamais
 * un type non couvert par la passe.
 */
export async function expireResolvedRecommendations(
  organizationId: string,
  types: RecommendationType[],
  seenKeys: string[],
  now: Date = new Date(),
): Promise<number> {
  if (types.length === 0) return 0;
  const keep = new Set(seenKeys);
  const active = await prisma.businessRecommendation.findMany({
    where: {
      organizationId,
      type: { in: types },
      status: { in: ["NEW", "VIEWED", "ACTION_PREPARED"] },
    },
    select: { id: true, dedupeKey: true },
  });
  const stale = active.filter((r) => !keep.has(r.dedupeKey)).map((r) => r.id);
  if (stale.length === 0) return 0;
  const { count } = await prisma.businessRecommendation.updateMany({
    where: { id: { in: stale } },
    data: { status: "EXPIRED", expiresAt: now },
  });
  return count;
}

// ─────────────────────────── Lecture ───────────────────────────

export type RecommendationFilters = {
  status?: "OPEN" | "ALL" | "DISMISSED";
  priority?: RecommendationPriority;
  type?: RecommendationType;
};

const OPEN_STATUSES = ["NEW", "VIEWED", "ACTION_PREPARED"] as const;

export async function listRecommendations(
  organizationId: string,
  role: Role,
  userId: string,
  filters: RecommendationFilters = {},
  take = 100,
) {
  const statusWhere: Prisma.BusinessRecommendationWhereInput =
    filters.status === "ALL"
      ? {}
      : filters.status === "DISMISSED"
        ? { status: "DISMISSED" }
        : { status: { in: [...OPEN_STATUSES] } };

  return prisma.businessRecommendation.findMany({
    where: {
      organizationId,
      ...recommendationScopeWhere(role, userId),
      ...statusWhere,
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    },
    orderBy: [{ priority: "desc" }, { detectedAt: "desc" }],
    take,
  });
}

export async function countOpenRecommendations(
  organizationId: string,
  role: Role,
  userId: string,
): Promise<{ total: number; byPriority: Record<RecommendationPriority, number> }> {
  const rows = await prisma.businessRecommendation.groupBy({
    by: ["priority"],
    where: {
      organizationId,
      ...recommendationScopeWhere(role, userId),
      status: { in: [...OPEN_STATUSES] },
      type: { not: "DAILY_SUMMARY" },
    },
    _count: { _all: true },
  });
  const byPriority: Record<RecommendationPriority, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  let total = 0;
  for (const r of rows) {
    byPriority[r.priority] = r._count._all;
    total += r._count._all;
  }
  return { total, byPriority };
}

export async function markRecommendationsViewed(
  organizationId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await prisma.businessRecommendation.updateMany({
    where: { organizationId, id: { in: ids }, status: "NEW" },
    data: { status: "VIEWED" },
  });
}

export async function dismissRecommendation(input: {
  organizationId: string;
  recommendationId: string;
  actorUserId: string;
  role: Role;
}): Promise<{ id: string }> {
  const rec = await prisma.businessRecommendation.findFirst({
    where: { id: input.recommendationId, organizationId: input.organizationId },
    select: { id: true, ownerUserId: true, status: true },
  });
  if (!rec) throw NotFound("Recommandation introuvable.");
  if (!canSeeAllCrm(input.role) && rec.ownerUserId !== input.actorUserId) {
    throw NotFound("Recommandation introuvable.");
  }
  if (rec.status === "DISMISSED") return { id: rec.id };

  await prisma.businessRecommendation.update({
    where: { id: rec.id },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      dismissedByUserId: input.actorUserId,
    },
  });
  await writeAuditLog({
    action: "RECOMMENDATION_DISMISSED",
    entityType: "business_recommendation",
    entityId: rec.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
  });
  return { id: rec.id };
}

export async function getRecommendation(
  organizationId: string,
  recommendationId: string,
  role: Role,
  userId: string,
) {
  const rec = await prisma.businessRecommendation.findFirst({
    where: { id: recommendationId, organizationId },
  });
  if (!rec) throw NotFound("Recommandation introuvable.");
  if (!canSeeAllCrm(role) && rec.ownerUserId !== userId) {
    throw NotFound("Recommandation introuvable.");
  }
  return rec;
}

export async function markRecommendationPrepared(
  recommendationId: string,
  now: Date = new Date(),
): Promise<void> {
  await prisma.businessRecommendation.update({
    where: { id: recommendationId },
    data: { status: "ACTION_PREPARED", actedAt: now },
  });
}

export async function markRecommendationActioned(
  recommendationId: string,
  now: Date = new Date(),
): Promise<void> {
  await prisma.businessRecommendation.updateMany({
    where: { id: recommendationId, status: { in: [...OPEN_STATUSES] } },
    data: { status: "ACTIONED", actedAt: now },
  });
}

/** Garde-fou : les recommandations n'exécutent jamais d'action irréversible seules (§19, §53). */
export function assertPreparableAction(actionType: RecommendationActionType | null): void {
  const allowed: RecommendationActionType[] = [
    "PREPARE_REMINDER",
    "PREPARE_CAMPAIGN",
    "OPEN_CUSTOMER",
    "OPEN_ORDER",
    "OPEN_PRODUCT",
  ];
  if (!actionType || !allowed.includes(actionType)) {
    throw Conflict("Cette recommandation ne propose aucune action préparable.");
  }
}
