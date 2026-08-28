import "server-only";
import type { AutomationRuleType, Prisma, RecommendationType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logError, NotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import { notify } from "@/server/notifications/notification-service";
import {
  DEFAULT_RULE_TYPES,
  DETECTABLE_RULE_TYPES,
  RULE_META,
  effectiveRuleConfig,
} from "./rules";
import { DETECTORS } from "./detectors";
import {
  expireResolvedRecommendations,
  upsertRecommendations,
  type DetectedRecommendation,
} from "./recommendation-service";

/**
 * Orchestrateur des automatisations. `runAutomationsForOrganization` exécute
 * les détecteurs des règles ACTIVES, écrit les recommandations (dédupe +
 * cooldown), expire celles dont le problème a disparu (§38), et trace chaque
 * passe via `AutomationRun`. Aucune action externe n'est déclenchée ici.
 */

// ─────────────────────────── Règles ───────────────────────────

export async function ensureDefaultRules(
  organizationId: string,
  actorUserId?: string | null,
): Promise<{ created: number }> {
  const existing = await prisma.automationRule.findMany({
    where: { organizationId },
    select: { type: true },
  });
  const have = new Set(existing.map((r) => r.type));
  let created = 0;
  for (const type of DEFAULT_RULE_TYPES) {
    if (have.has(type)) continue;
    const meta = RULE_META[type];
    await prisma.automationRule.create({
      data: {
        organizationId,
        type,
        name: meta.name,
        description: meta.description,
        // §59 : aucune règle à effet externe automatique ; ici toutes sont
        // internes (détection), donc on suit `defaultEnabled`.
        enabled: meta.defaultEnabled,
        config: meta.defaultConfig as Prisma.InputJsonValue,
        schedule: meta.defaultSchedule,
        createdByUserId: actorUserId ?? null,
      },
    });
    created++;
  }
  if (created > 0) {
    await writeAuditLog({
      action: "AUTOMATION_RULE_CREATED",
      entityType: "automation_rule",
      organizationId,
      actorUserId: actorUserId ?? null,
      metadata: { createdDefaults: created },
    });
  }
  return { created };
}

export async function listAutomationRules(organizationId: string) {
  await ensureDefaultRules(organizationId);
  return prisma.automationRule.findMany({
    where: { organizationId },
    orderBy: { type: "asc" },
    include: {
      runs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
}

export async function setAutomationRuleEnabled(input: {
  organizationId: string;
  ruleId: string;
  enabled: boolean;
  actorUserId: string;
}): Promise<{ id: string; enabled: boolean }> {
  const rule = await prisma.automationRule.findFirst({
    where: { id: input.ruleId, organizationId: input.organizationId },
    select: { id: true, type: true },
  });
  if (!rule) throw NotFound("Règle introuvable.");
  const updated = await prisma.automationRule.update({
    where: { id: rule.id },
    data: { enabled: input.enabled },
    select: { id: true, enabled: true },
  });
  await writeAuditLog({
    action: "AUTOMATION_RULE_UPDATED",
    entityType: "automation_rule",
    entityId: rule.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { type: rule.type, enabled: input.enabled },
  });
  return updated;
}

export async function updateAutomationRuleConfig(input: {
  organizationId: string;
  ruleId: string;
  config: Record<string, number | string | boolean>;
  actorUserId: string;
}): Promise<{ id: string }> {
  const rule = await prisma.automationRule.findFirst({
    where: { id: input.ruleId, organizationId: input.organizationId },
    select: { id: true, type: true },
  });
  if (!rule) throw NotFound("Règle introuvable.");
  const merged = effectiveRuleConfig(rule.type, input.config);
  await prisma.automationRule.update({
    where: { id: rule.id },
    data: { config: merged as Prisma.InputJsonValue },
  });
  await writeAuditLog({
    action: "AUTOMATION_RULE_UPDATED",
    entityType: "automation_rule",
    entityId: rule.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { type: rule.type, config: merged },
  });
  return { id: rule.id };
}

// ─────────────────────────── Passe d'automatisation ───────────────────────────

export type AutomationPassResult = {
  organizationId: string;
  rulesRun: number;
  created: number;
  updated: number;
  skipped: number;
  expired: number;
  failures: Array<{ type: AutomationRuleType; error: string }>;
};

const RECO_TYPE_BY_RULE: Partial<Record<AutomationRuleType, RecommendationType>> = {
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  OVERDUE_DEBT: "OVERDUE_DEBT",
  PAYMENT_DUE_SOON: "PAYMENT_DUE_SOON",
  INACTIVE_CUSTOMER: "INACTIVE_CUSTOMER",
  SALES_OPPORTUNITY: "SALES_OPPORTUNITY",
  ORDER_PENDING_CONFIRMATION: "ORDER_PENDING_CONFIRMATION",
  ORDER_STUCK: "ORDER_STUCK",
  ORDER_TO_PREPARE: "ORDER_TO_PREPARE",
  DAILY_SUMMARY: "DAILY_SUMMARY",
};

export async function runAutomationsForOrganization(input: {
  organizationId: string;
  timezone: string;
  currency: string;
  /** Sous-ensemble de types ; défaut = toutes les règles activées détectables. */
  types?: AutomationRuleType[];
  actorUserId?: string | null;
  now?: Date;
  /** Force l'exécution même si la règle est désactivée (usage debug/seed). */
  ignoreEnabled?: boolean;
}): Promise<AutomationPassResult> {
  const now = input.now ?? new Date();
  await ensureDefaultRules(input.organizationId, input.actorUserId ?? null);

  const rules = await prisma.automationRule.findMany({
    where: {
      organizationId: input.organizationId,
      type: { in: input.types ?? DETECTABLE_RULE_TYPES },
      ...(input.ignoreEnabled ? {} : { enabled: true }),
    },
  });

  const result: AutomationPassResult = {
    organizationId: input.organizationId,
    rulesRun: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    expired: 0,
    failures: [],
  };

  for (const rule of rules) {
    const detector = DETECTORS[rule.type as keyof typeof DETECTORS];
    if (!detector) continue;
    result.rulesRun++;

    const run = await prisma.automationRun.create({
      data: {
        organizationId: input.organizationId,
        ruleId: rule.id,
        type: rule.type,
        status: "RUNNING",
      },
      select: { id: true },
    });

    try {
      const cfg = effectiveRuleConfig(rule.type, rule.config);
      const detected = await detector({
        organizationId: input.organizationId,
        timezone: input.timezone,
        currency: input.currency,
        now,
        config: cfg,
      });

      const up = await upsertRecommendations(input.organizationId, detected, {
        now,
        actorUserId: input.actorUserId ?? null,
      });
      result.created += up.created;
      result.updated += up.updated;
      result.skipped += up.skipped;

      // Expiration ciblée sur CE type (§38). DAILY_SUMMARY n'expire pas (périodique).
      const recoType = RECO_TYPE_BY_RULE[rule.type];
      if (recoType && rule.type !== "DAILY_SUMMARY") {
        result.expired += await expireResolvedRecommendations(
          input.organizationId,
          [recoType],
          up.seenKeys,
          now,
        );
      }

      await notifyHighPriority(input.organizationId, detected, up.created > 0);

      await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: "COMPLETED", completedAt: new Date(), itemsDetected: detected.length },
      });
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: now },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      logError("automation.detector", { type: rule.type, error: msg });
      result.failures.push({ type: rule.type, error: msg });
      await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: "FAILED", completedAt: new Date(), errorCode: msg.slice(0, 120) },
      });
    }
  }

  await writeAuditLog({
    action: "AUTOMATION_RUN_COMPLETED",
    entityType: "automation_run",
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    metadata: {
      rulesRun: result.rulesRun,
      created: result.created,
      updated: result.updated,
      expired: result.expired,
      failures: result.failures.length,
    },
  });

  return result;
}

async function notifyHighPriority(
  organizationId: string,
  detected: DetectedRecommendation[],
  anyCreated: boolean,
): Promise<void> {
  if (!anyCreated) return;
  const urgent = detected.filter((d) => d.priority === "HIGH" || d.priority === "CRITICAL");
  for (const d of urgent.slice(0, 20)) {
    await notify({
      organizationId,
      userId: d.ownerUserId ?? null,
      type:
        d.type === "OVERDUE_DEBT" || d.type === "PAYMENT_DUE_SOON"
          ? "DEBT"
          : d.type === "LOW_STOCK" || d.type === "OUT_OF_STOCK"
            ? "STOCK"
            : d.type.startsWith("ORDER_")
              ? "ORDER"
              : "RECOMMENDATION",
      title: d.title,
      body: d.description,
      entityType: d.entityType ?? "business_recommendation",
      entityId: d.entityId ?? null,
      dedupe: true,
    });
  }
}

// ─────────────────────────── Multi-organisation (scheduler) ───────────────────────────

export async function runAutomationsForAllOrganizations(
  now: Date = new Date(),
): Promise<{ organizations: number; totalCreated: number }> {
  const orgs = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, timezone: true, currency: true },
  });
  let totalCreated = 0;
  for (const o of orgs) {
    try {
      const r = await runAutomationsForOrganization({
        organizationId: o.id,
        timezone: o.timezone,
        currency: o.currency,
        now,
      });
      totalCreated += r.created;
    } catch (err) {
      logError("automation.pass", { organizationId: o.id, error: err instanceof Error ? err.message : "unknown" });
    }
  }
  return { organizations: orgs.length, totalCreated };
}
