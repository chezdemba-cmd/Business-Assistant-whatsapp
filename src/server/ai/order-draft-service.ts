import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { Conflict, NotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import { createOrder } from "@/server/orders/order-service";

/**
 * Brouillons de commande issus de l'IA (ou de l'assistant interne).
 *
 * RÈGLES :
 *  - le draft n'est JAMAIS la source de vérité ;
 *  - AUCUNE réservation de stock tant qu'il n'est pas converti ;
 *  - la conversion passe par `createOrder` (recharge prix, verrouille, réserve,
 *    snapshots) — si le stock a changé entre-temps, la conversion échoue et le
 *    draft n'est pas marqué CONVERTED.
 */

const DRAFT_TTL_MS = 48 * 60 * 60 * 1000;

export type DraftLineInput = { productId: string; quantity: number };

export type CreateDraftInput = {
  organizationId: string;
  conversationId: string;
  customerId: string;
  /** Message client déclencheur — clé d'idempotence. */
  sourceMessageId: string;
  lines: DraftLineInput[];
  notes?: string | null;
  createdByUserId?: string | null;
  aiRunId?: string | null;
};

export async function createOrderDraftForConversation(
  input: CreateDraftInput,
): Promise<{ draftId: string; deduped: boolean; totalAmount: number }> {
  // Idempotence : même (conversation, message) → même draft.
  const existing = await prisma.orderDraft.findUnique({
    where: {
      conversationId_sourceMessageId: {
        conversationId: input.conversationId,
        sourceMessageId: input.sourceMessageId,
      },
    },
    select: { id: true, totalAmount: true },
  });
  if (existing) {
    return { draftId: existing.id, deduped: true, totalAmount: existing.totalAmount };
  }

  const byProduct = new Map<string, number>();
  for (const l of input.lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
      throw Conflict("Quantité de brouillon invalide.");
    }
    byProduct.set(l.productId, (byProduct.get(l.productId) ?? 0) + l.quantity);
  }
  if (byProduct.size === 0) throw Conflict("Brouillon sans article.");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { currency: true },
  });
  const products = await prisma.product.findMany({
    where: {
      id: { in: [...byProduct.keys()] },
      organizationId: input.organizationId,
      status: "ACTIVE",
    },
    select: { id: true, name: true, sku: true, salePrice: true },
  });
  if (products.length !== byProduct.size) {
    throw NotFound("Un produit du brouillon est introuvable ou inactif.");
  }

  const items = products.map((p) => {
    const quantity = byProduct.get(p.id)!;
    return {
      organizationId: input.organizationId,
      productId: p.id,
      productNameSnapshot: p.name,
      skuSnapshot: p.sku,
      quantity,
      unitPrice: p.salePrice,
      subtotal: p.salePrice * quantity,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

  let draftId: string;
  try {
    const draft = await prisma.orderDraft.create({
      data: {
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        customerId: input.customerId,
        createdByUserId: input.createdByUserId ?? null,
        sourceMessageId: input.sourceMessageId,
        status: "AWAITING_CUSTOMER_CONFIRMATION",
        currency: org.currency,
        subtotal,
        totalAmount: subtotal,
        notes: input.notes ?? null,
        expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
        items: { create: items },
      },
      select: { id: true },
    });
    draftId = draft.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await prisma.orderDraft.findUnique({
        where: {
          conversationId_sourceMessageId: {
            conversationId: input.conversationId,
            sourceMessageId: input.sourceMessageId,
          },
        },
        select: { id: true, totalAmount: true },
      });
      if (again) return { draftId: again.id, deduped: true, totalAmount: again.totalAmount };
    }
    throw e;
  }

  await prisma.customerActivity.create({
    data: {
      organizationId: input.organizationId,
      customerId: input.customerId,
      type: "AI_ORDER_DRAFT_CREATED",
      title: `Djeli IA a préparé un brouillon de commande (${subtotal})`,
      metadata: { draftId, conversationId: input.conversationId },
    },
  });
  await writeAuditLog({
    action: "AI_ORDER_DRAFT_CREATED",
    entityType: "order_draft",
    entityId: draftId,
    organizationId: input.organizationId,
    metadata: { conversationId: input.conversationId, itemCount: items.length, total: subtotal },
  });

  return { draftId, deduped: false, totalAmount: subtotal };
}

export async function markDraftCustomerConfirmed(
  organizationId: string,
  draftId: string,
): Promise<{ status: string }> {
  const draft = await prisma.orderDraft.findFirst({
    where: { id: draftId, organizationId },
    select: { id: true, status: true },
  });
  if (!draft) throw NotFound("Brouillon introuvable.");
  if (
    draft.status !== "DRAFT" &&
    draft.status !== "AWAITING_CUSTOMER_CONFIRMATION"
  ) {
    return { status: draft.status };
  }
  await prisma.orderDraft.update({
    where: { id: draft.id },
    // MVP : la confirmation client mène toujours à une validation humaine.
    data: { status: "AWAITING_HUMAN_APPROVAL" },
  });
  return { status: "AWAITING_HUMAN_APPROVAL" };
}

export async function getActiveDraftForConversation(
  organizationId: string,
  conversationId: string,
) {
  return prisma.orderDraft.findFirst({
    where: {
      organizationId,
      conversationId,
      status: {
        in: ["DRAFT", "AWAITING_CUSTOMER_CONFIRMATION", "AWAITING_HUMAN_APPROVAL"],
      },
    },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
}

/**
 * Approbation humaine → conversion en vraie commande via `createOrder`.
 * Toute la logique métier (prix serveur, stock, verrous, réservation) reste
 * dans `createOrder`. Échec stock ⇒ l'erreur remonte, le draft reste ouvert.
 */
export async function approveOrderDraft(input: {
  organizationId: string;
  draftId: string;
  actorUserId: string;
}): Promise<{ orderId: string; reference: string }> {
  const draft = await prisma.orderDraft.findFirst({
    where: { id: input.draftId, organizationId: input.organizationId },
    include: { items: true },
  });
  if (!draft) throw NotFound("Brouillon introuvable dans cette entreprise.");
  if (draft.status === "CONVERTED" && draft.convertedOrderId) {
    const o = await prisma.order.findUnique({
      where: { id: draft.convertedOrderId },
      select: { reference: true },
    });
    return { orderId: draft.convertedOrderId, reference: o?.reference ?? "" };
  }
  if (
    draft.status !== "AWAITING_HUMAN_APPROVAL" &&
    draft.status !== "CUSTOMER_CONFIRMED" &&
    draft.status !== "APPROVED"
  ) {
    throw Conflict("Ce brouillon n'est pas en attente de validation.");
  }
  if (!draft.customerId) throw Conflict("Brouillon sans client.");

  // Peut lever Conflict (« Stock insuffisant… ») — on ne convertit pas alors.
  const { orderId, reference } = await createOrder({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    customerId: draft.customerId,
    lines: draft.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    notes: draft.notes,
    source: "AI",
  });

  await prisma.orderDraft.update({
    where: { id: draft.id },
    data: { status: "CONVERTED", convertedOrderId: orderId },
  });
  await writeAuditLog({
    action: "AI_ORDER_DRAFT_CONVERTED",
    entityType: "order_draft",
    entityId: draft.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { orderId, reference },
  });

  return { orderId, reference };
}

export async function rejectOrderDraft(input: {
  organizationId: string;
  draftId: string;
  actorUserId: string;
  reason?: string | null;
}): Promise<{ ok: true }> {
  const draft = await prisma.orderDraft.findFirst({
    where: { id: input.draftId, organizationId: input.organizationId },
    select: { id: true, status: true },
  });
  if (!draft) throw NotFound("Brouillon introuvable dans cette entreprise.");
  if (draft.status === "CONVERTED") {
    throw Conflict("Ce brouillon a déjà été converti en commande.");
  }
  await prisma.orderDraft.update({
    where: { id: draft.id },
    data: { status: "REJECTED", rejectionReason: input.reason ?? null },
  });
  return { ok: true as const };
}
