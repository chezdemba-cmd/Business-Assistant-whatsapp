import "server-only";
import { prisma } from "@/server/db/client";
import { Conflict, NotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import { balanceDue as calcBalanceDue } from "./payment-rules";
import { buildReminderMessage } from "./reminder-template";

/**
 * Relances — PRÉPARATION UNIQUEMENT. Aucune intégration WhatsApp : « envoyer »
 * marque la campagne et ses lignes comme envoyées en MODE SIMULATION (§24,
 * §27). L'UI doit l'indiquer clairement (« simulation / WhatsApp non
 * connecté »). On n'affirme jamais qu'un message est réellement parti.
 */

const TX_OPTS = { timeout: 20_000 } as const;

export type CreateReminderCampaignInput = {
  organizationId: string;
  actorUserId: string;
  name?: string | null;
  /** Une ligne par commande — créance recouvrable requise (LIVRÉE + solde). */
  orderIds?: string[];
  /** Une ligne agrégée par client (orderId null). */
  customerIds?: string[];
};

export async function createReminderCampaign(
  input: CreateReminderCampaignInput,
): Promise<{ campaignId: string; itemCount: number }> {
  const orderIds = [...new Set(input.orderIds ?? [])];
  const customerIds = [...new Set(input.customerIds ?? [])];
  if (orderIds.length === 0 && customerIds.length === 0) {
    throw Conflict("Sélectionnez au moins une créance à relancer.");
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { name: true, currency: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    type ItemDraft = {
      customerId: string;
      customerName: string;
      orderId: string | null;
      amountDue: number;
      message: string;
    };
    const drafts: ItemDraft[] = [];

    if (orderIds.length > 0) {
      const orders = await tx.order.findMany({
        where: {
          id: { in: orderIds },
          organizationId: input.organizationId,
          status: "DELIVERED",
        },
        select: {
          id: true,
          reference: true,
          totalAmount: true,
          amountPaid: true,
          dueDate: true,
          customer: { select: { id: true, displayName: true } },
        },
      });
      if (orders.length !== orderIds.length) {
        throw NotFound("Une créance sélectionnée est introuvable ou non livrée.");
      }
      for (const o of orders) {
        const bal = calcBalanceDue(o.totalAmount, o.amountPaid);
        if (bal <= 0) {
          throw Conflict(`La commande ${o.reference} est déjà soldée.`);
        }
        drafts.push({
          customerId: o.customer.id,
          customerName: o.customer.displayName,
          orderId: o.id,
          amountDue: bal,
          message: buildReminderMessage({
            customerName: o.customer.displayName,
            organizationName: org.name,
            orderReference: o.reference,
            balanceDue: bal,
            currency: org.currency,
            dueDate: o.dueDate,
          }),
        });
      }
    }

    if (customerIds.length > 0) {
      const customers = await tx.customer.findMany({
        where: { id: { in: customerIds }, organizationId: input.organizationId },
        select: { id: true, displayName: true },
      });
      if (customers.length !== customerIds.length) {
        throw NotFound("Un client sélectionné est introuvable.");
      }
      const outstanding = await tx.order.findMany({
        where: {
          organizationId: input.organizationId,
          customerId: { in: customerIds },
          status: "DELIVERED",
          paymentStatus: { not: "PAID" },
        },
        select: {
          customerId: true,
          totalAmount: true,
          amountPaid: true,
          dueDate: true,
        },
      });
      const byCustomer = new Map<
        string,
        { amount: number; oldestDue: Date | null }
      >();
      for (const o of outstanding) {
        const bal = calcBalanceDue(o.totalAmount, o.amountPaid);
        if (bal <= 0) continue;
        const cur = byCustomer.get(o.customerId) ?? {
          amount: 0,
          oldestDue: null as Date | null,
        };
        cur.amount += bal;
        if (o.dueDate && (!cur.oldestDue || o.dueDate < cur.oldestDue)) {
          cur.oldestDue = o.dueDate;
        }
        byCustomer.set(o.customerId, cur);
      }
      for (const c of customers) {
        const agg = byCustomer.get(c.id);
        if (!agg || agg.amount <= 0) {
          throw Conflict(`${c.displayName} n'a aucune créance en cours.`);
        }
        drafts.push({
          customerId: c.id,
          customerName: c.displayName,
          orderId: null,
          amountDue: agg.amount,
          message: buildReminderMessage({
            customerName: c.displayName,
            organizationName: org.name,
            balanceDue: agg.amount,
            currency: org.currency,
            dueDate: agg.oldestDue,
          }),
        });
      }
    }

    const campaign = await tx.reminderCampaign.create({
      data: {
        organizationId: input.organizationId,
        name: input.name?.trim() || null,
        status: "DRAFT",
        createdByUserId: input.actorUserId,
      },
    });

    await tx.reminderCampaignItem.createMany({
      data: drafts.map((d) => ({
        organizationId: input.organizationId,
        campaignId: campaign.id,
        customerId: d.customerId,
        orderId: d.orderId,
        amountDue: d.amountDue,
        message: d.message,
        status: "PENDING",
      })),
    });

    for (const cid of new Set(drafts.map((d) => d.customerId))) {
      await tx.customerActivity.create({
        data: {
          organizationId: input.organizationId,
          customerId: cid,
          type: "REMINDER_PREPARED",
          title: "Relance préparée",
          actorUserId: input.actorUserId,
          metadata: { campaignId: campaign.id },
        },
      });
    }

    return { campaignId: campaign.id, itemCount: drafts.length };
  }, TX_OPTS);

  await writeAuditLog({
    action: "REMINDER_CAMPAIGN_CREATED",
    entityType: "reminder_campaign",
    entityId: result.campaignId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { itemCount: result.itemCount },
  });

  return result;
}

/**
 * « Envoi » en MODE SIMULATION : marque la campagne et ses lignes comme
 * envoyées. Aucun message réel n'est transmis.
 */
export async function sendReminderCampaign(input: {
  organizationId: string;
  actorUserId: string;
  campaignId: string;
}): Promise<{ campaignId: string; sentCount: number; simulated: true }> {
  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.reminderCampaign.findFirst({
      where: { id: input.campaignId, organizationId: input.organizationId },
      select: { id: true, status: true },
    });
    if (!campaign) throw NotFound("Campagne introuvable dans cette entreprise.");
    if (campaign.status === "SENT") {
      throw Conflict("Cette campagne a déjà été envoyée (simulation).");
    }
    if (campaign.status === "CANCELLED") {
      throw Conflict("Cette campagne est annulée.");
    }

    const now = new Date();
    const { count } = await tx.reminderCampaignItem.updateMany({
      where: {
        campaignId: campaign.id,
        organizationId: input.organizationId,
        status: "PENDING",
      },
      data: { status: "SENT", sentAt: now },
    });
    await tx.reminderCampaign.update({
      where: { id: campaign.id },
      data: { status: "SENT", sentAt: now },
    });

    const items = await tx.reminderCampaignItem.findMany({
      where: { campaignId: campaign.id, organizationId: input.organizationId },
      select: { customerId: true },
    });
    for (const cid of new Set(items.map((i) => i.customerId))) {
      await tx.customerActivity.create({
        data: {
          organizationId: input.organizationId,
          customerId: cid,
          type: "REMINDER_SENT",
          title: "Relance envoyée (simulation)",
          actorUserId: input.actorUserId,
          metadata: { campaignId: campaign.id, simulated: true },
        },
      });
    }

    return { sentCount: count };
  }, TX_OPTS);

  await writeAuditLog({
    action: "REMINDER_SENT",
    entityType: "reminder_campaign",
    entityId: input.campaignId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { sentCount: result.sentCount, simulated: true },
  });

  return { campaignId: input.campaignId, sentCount: result.sentCount, simulated: true };
}

export async function cancelReminderCampaign(input: {
  organizationId: string;
  actorUserId: string;
  campaignId: string;
}): Promise<{ campaignId: string }> {
  await prisma.$transaction(async (tx) => {
    const campaign = await tx.reminderCampaign.findFirst({
      where: { id: input.campaignId, organizationId: input.organizationId },
      select: { id: true, status: true },
    });
    if (!campaign) throw NotFound("Campagne introuvable dans cette entreprise.");
    if (campaign.status === "SENT") {
      throw Conflict("Une campagne envoyée ne peut plus être annulée.");
    }
    if (campaign.status === "CANCELLED") return;

    await tx.reminderCampaignItem.updateMany({
      where: {
        campaignId: campaign.id,
        organizationId: input.organizationId,
        status: "PENDING",
      },
      data: { status: "SKIPPED" },
    });
    await tx.reminderCampaign.update({
      where: { id: campaign.id },
      data: { status: "CANCELLED" },
    });
  }, TX_OPTS);

  await writeAuditLog({
    action: "REMINDER_CANCELLED",
    entityType: "reminder_campaign",
    entityId: input.campaignId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
  });

  return { campaignId: input.campaignId };
}
