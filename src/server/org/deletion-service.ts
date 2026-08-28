import "server-only";
import { prisma } from "@/server/db/client";
import { Conflict, NotFound } from "@/server/errors";
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
