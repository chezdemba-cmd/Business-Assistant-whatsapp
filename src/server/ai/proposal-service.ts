import "server-only";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { Conflict, Forbidden, NotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import { can } from "@/server/rbac/permissions";
import { createReminderCampaign } from "@/server/finance/reminder-service";
import { approveOrderDraft } from "./order-draft-service";

/**
 * Exécution des propositions d'action de l'assistant `/ai`, TOUJOURS après
 * confirmation humaine. Jamais de paiement, jamais d'ajustement de stock.
 */

export async function approveProposal(input: {
  organizationId: string;
  proposalId: string;
  actorUserId: string;
  role: Role;
}): Promise<{ redirectTo?: string; summary: string }> {
  const proposal = await prisma.aiActionProposal.findFirst({
    where: { id: input.proposalId, organizationId: input.organizationId },
  });
  if (!proposal) throw NotFound("Proposition introuvable dans cette entreprise.");
  if (proposal.status !== "PENDING") {
    throw Conflict("Cette proposition a déjà été traitée.");
  }

  const payload = (proposal.payload ?? {}) as Record<string, unknown>;
  let redirectTo: string | undefined;
  let summary = proposal.summary;

  if (proposal.type === "PREPARE_REMINDER") {
    if (!can(input.role, "debts.write")) {
      throw Forbidden("Permission « debts.write » requise pour préparer une relance.");
    }
    const customerId = String(payload.customerId ?? "");
    if (!customerId) throw Conflict("Proposition incomplète.");
    const res = await createReminderCampaign({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      customerIds: [customerId],
    });
    redirectTo = `/reminders/${res.campaignId}`;
    summary = `Campagne de relance préparée (${res.itemCount} ligne(s)).`;
  } else if (proposal.type === "CREATE_ORDER_FROM_DRAFT") {
    if (!can(input.role, "orders.write")) {
      throw Forbidden("Permission « orders.write » requise pour créer une commande.");
    }
    const draftId = String(payload.draftId ?? "");
    if (!draftId) throw Conflict("Proposition incomplète.");
    const res = await approveOrderDraft({
      organizationId: input.organizationId,
      draftId,
      actorUserId: input.actorUserId,
    });
    redirectTo = `/orders/${res.orderId}`;
    summary = `Commande ${res.reference} créée.`;
  } else {
    throw Conflict("Type de proposition non pris en charge.");
  }

  await prisma.aiActionProposal.update({
    where: { id: proposal.id },
    data: {
      status: "EXECUTED",
      approvedByUserId: input.actorUserId,
      approvedAt: new Date(),
      executedAt: new Date(),
      resultSummary: summary,
    },
  });
  await writeAuditLog({
    action: "AI_ACTION_APPROVED",
    entityType: "ai_action_proposal",
    entityId: proposal.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { type: proposal.type, summary },
  });

  return { redirectTo, summary };
}

export async function rejectProposal(input: {
  organizationId: string;
  proposalId: string;
  actorUserId: string;
}): Promise<{ ok: true }> {
  const proposal = await prisma.aiActionProposal.findFirst({
    where: { id: input.proposalId, organizationId: input.organizationId },
    select: { id: true, status: true, type: true },
  });
  if (!proposal) throw NotFound("Proposition introuvable dans cette entreprise.");
  if (proposal.status !== "PENDING") return { ok: true as const };

  await prisma.aiActionProposal.update({
    where: { id: proposal.id },
    data: { status: "REJECTED", approvedByUserId: input.actorUserId, approvedAt: new Date() },
  });
  await writeAuditLog({
    action: "AI_ACTION_REJECTED",
    entityType: "ai_action_proposal",
    entityId: proposal.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { type: proposal.type },
  });
  return { ok: true as const };
}
