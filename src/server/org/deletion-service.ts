import "server-only";
import { prisma } from "@/server/db/client";
import { Conflict, NotFound, logError } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";

/**
 * Suppression d'organisation (§30). Jamais brutale :
 *   request → période de grâce (export possible) → suppression/anonymisation.
 * Pour le pilote, la purge finale reste administrative (script + validation) —
 * ici on gère la demande, la grâce et l'annulation.
 */

const GRACE_DAYS = 14;

export async function requestOrganizationDeletion(input: {
  organizationId: string;
  requestedByUserId: string;
  reason?: string | null;
}): Promise<{ id: string; purgeAfter: Date }> {
  const existing = await prisma.organizationDeletionRequest.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (existing && ["REQUESTED", "GRACE_PERIOD"].includes(existing.status)) {
    return { id: existing.id, purgeAfter: existing.purgeAfter };
  }

  const purgeAfter = new Date(Date.now() + GRACE_DAYS * 86_400_000);
  const row = await prisma.organizationDeletionRequest.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      requestedByUserId: input.requestedByUserId,
      reason: input.reason?.trim() || null,
      status: "GRACE_PERIOD",
      purgeAfter,
    },
    update: {
      status: "GRACE_PERIOD",
      requestedByUserId: input.requestedByUserId,
      reason: input.reason?.trim() || null,
      purgeAfter,
      cancelledAt: null,
      completedAt: null,
    },
    select: { id: true, purgeAfter: true },
  });

  await writeAuditLog({
    action: "SETTINGS_UPDATED",
    entityType: "organization",
    entityId: input.organizationId,
    organizationId: input.organizationId,
    actorUserId: input.requestedByUserId,
    metadata: { change: "deletion_requested", purgeAfter: purgeAfter.toISOString() },
  });
  return row;
}

export async function cancelOrganizationDeletion(input: {
  organizationId: string;
  actorUserId: string;
}): Promise<void> {
  const req = await prisma.organizationDeletionRequest.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (!req) throw NotFound("Aucune demande de suppression en cours.");
  if (req.status === "COMPLETED") throw Conflict("La suppression est déjà effective.");
  await prisma.organizationDeletionRequest.update({
    where: { organizationId: input.organizationId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  await writeAuditLog({
    action: "SETTINGS_UPDATED",
    entityType: "organization",
    entityId: input.organizationId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { change: "deletion_cancelled" },
  });
}

export function getDeletionRequest(organizationId: string) {
  return prisma.organizationDeletionRequest.findUnique({ where: { organizationId } });
}

/**
 * Purge effective (§28) : pour chaque demande dont la période de grâce est
 * écoulée et qui n'a pas été annulée, l'organisation et TOUTES ses données sont
 * supprimées (cascades FK natives `ON DELETE CASCADE`). La `OrganizationDeletionRequest`
 * disparaît avec l'organisation ; une entrée d'audit `ORGANIZATION_PURGED` en
 * conserve la trace (les `audit_logs` survivent — `organizationId` passe à NULL,
 * les détails restent dans `metadata`).
 *
 * Appelé par `runMaintenance()`. Une erreur sur une organisation n'interrompt
 * pas le traitement des autres.
 */
export async function purgeExpiredDeletionRequests(
  now: Date = new Date(),
): Promise<{ purged: number; failed: number }> {
  const due = await prisma.organizationDeletionRequest.findMany({
    where: {
      status: { in: ["REQUESTED", "GRACE_PERIOD"] },
      purgeAfter: { lt: now },
    },
    select: { organizationId: true, requestedByUserId: true, reason: true },
  });

  let purged = 0;
  let failed = 0;
  for (const req of due) {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { customers: true, orders: true, members: true, messages: true } },
        },
      });

      await writeAuditLog({
        action: "ORGANIZATION_PURGED",
        entityType: "organization",
        entityId: req.organizationId,
        organizationId: req.organizationId,
        actorUserId: req.requestedByUserId ?? null,
        metadata: {
          name: org?.name ?? null,
          slug: org?.slug ?? null,
          reason: req.reason ?? null,
          counts: org?._count ?? null,
          purgedAt: now.toISOString(),
        },
      });

      if (org) {
        await prisma.organization.delete({ where: { id: req.organizationId } });
      } else {
        // Organisation déjà absente : on solde la demande orpheline.
        await prisma.organizationDeletionRequest.updateMany({
          where: { organizationId: req.organizationId },
          data: { status: "COMPLETED", completedAt: now },
        });
      }
      purged += 1;
    } catch (e) {
      failed += 1;
      logError("org.deletion.purge", e, { organizationId: req.organizationId });
    }
  }
  return { purged, failed };
}
