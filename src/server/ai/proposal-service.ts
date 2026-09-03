import "server-only";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { Conflict, Forbidden, NotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import { can } from "@/server/rbac/permissions";
import { createReminderCampaign } from "@/server/finance/reminder-service";
import { createCampaign } from "@/server/marketing/campaign-service";
import { salesCampaignMessage } from "@/server/marketing/content";
import { getStockSnapshots } from "@/server/stock/stock-service";
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
  } else if (proposal.type === "PREPARE_SALES_CAMPAIGN") {
    if (!can(input.role, "marketing.manage")) {
      throw Forbidden("Permission « marketing.manage » requise pour préparer une campagne.");
    }
    const productId = String(payload.productId ?? "");
    if (!productId) throw Conflict("Proposition incomplète.");
    const [product, organization] = await Promise.all([
      prisma.product.findFirst({
        where: { id: productId, organizationId: input.organizationId, status: "ACTIVE" },
        select: { id: true, name: true, salePrice: true, alertThreshold: true, purchasePrice: true },
      }),
      prisma.organization.findUniqueOrThrow({
        where: { id: input.organizationId },
        select: { name: true, currency: true },
      }),
    ]);
    if (!product) throw NotFound("Produit introuvable dans cette entreprise.");
    const snapshots = await getStockSnapshots(input.organizationId, [product]);
    const available = Math.max(0, snapshots.get(product.id)?.available ?? 0);
    if (available === 0) throw Conflict("Ce produit n'a plus de stock disponible.");
    const campaign = await createCampaign({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      name: `Vente — ${product.name}`,
      type: "PROMOTION",
      audienceType: "PRODUCT_BUYERS",
      audienceConfig: { productId: product.id },
      message: salesCampaignMessage({
        organizationName: organization.name,
        productName: product.name,
        unitPrice: Number(product.salePrice),
        currency: organization.currency,
        available,
      }),
      channel: "WHATSAPP",
    });
    redirectTo = `/marketing/${campaign.id}`;
    summary = `Brouillon de campagne préparé pour ${product.name}. Aucun message envoyé.`;
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
