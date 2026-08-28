import "server-only";
import {
  Prisma,
  type PaymentMethod,
  type PaymentProvider,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { Conflict, NotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import {
  assertWithinBalance,
  balanceDue as calcBalanceDue,
  derivePaymentStatus,
  OverpaymentError,
} from "./payment-rules";

type Tx = Prisma.TransactionClient;

const TX_OPTS = { timeout: 20_000 } as const;

/** Verrou de la ligne commande avant tout recalcul de solde (anti-surpaiement
 *  concurrent §34). Deux paiements simultanés sont sérialisés par PostgreSQL. */
async function lockOrderRow(tx: Tx, orderId: string): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`,
  );
}

/**
 * Recalcule `amountPaid` (Σ paiements CONFIRMED) et `paymentStatus` dérivé
 * pour une commande, DANS la transaction. La ligne doit déjà être verrouillée.
 */
async function recomputeOrderPayment(
  tx: Tx,
  organizationId: string,
  orderId: string,
): Promise<{ amountPaid: number; balanceDue: number }> {
  const order = await tx.order.findFirstOrThrow({
    where: { id: orderId, organizationId },
    select: { totalAmount: true, dueDate: true },
  });
  const agg = await tx.payment.aggregate({
    where: { organizationId, orderId, status: "CONFIRMED" },
    _sum: { amount: true },
  });
  const amountPaid = agg._sum.amount ?? 0;
  const paymentStatus = derivePaymentStatus(order.totalAmount, amountPaid, {
    creditMode: order.dueDate != null,
  });
  await tx.order.update({
    where: { id: orderId },
    data: { amountPaid, paymentStatus },
  });
  return {
    amountPaid,
    balanceDue: calcBalanceDue(order.totalAmount, amountPaid),
  };
}

// ─────────────────────────── Enregistrer un paiement ───────────────────────────

export type RecordPaymentInput = {
  organizationId: string;
  actorUserId: string;
  customerId: string;
  orderId?: string | null;
  amount: number;
  method: PaymentMethod;
  provider?: PaymentProvider | null;
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date | null;
};

export async function recordPayment(
  input: RecordPaymentInput,
): Promise<{ paymentId: string; balanceDue: number | null }> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw Conflict("Le montant du paiement doit être un entier positif.");
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { currency: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, organizationId: input.organizationId },
      select: { id: true, displayName: true },
    });
    if (!customer) throw NotFound("Client introuvable dans cette entreprise.");

    let orderRef: string | null = null;
    let balanceDue: number | null = null;

    if (input.orderId) {
      const order = await tx.order.findFirst({
        where: { id: input.orderId, organizationId: input.organizationId },
        select: {
          id: true,
          reference: true,
          customerId: true,
          status: true,
          totalAmount: true,
        },
      });
      if (!order) throw NotFound("Commande introuvable dans cette entreprise.");
      if (order.customerId !== customer.id) {
        throw Conflict("Cette commande n'appartient pas à ce client.");
      }
      if (order.status === "CANCELLED" || order.status === "REJECTED") {
        throw Conflict("Impossible d'encaisser sur une commande annulée.");
      }

      await lockOrderRow(tx, order.id);

      // Relit le montant déjà payé APRÈS verrou.
      const agg = await tx.payment.aggregate({
        where: {
          organizationId: input.organizationId,
          orderId: order.id,
          status: "CONFIRMED",
        },
        _sum: { amount: true },
      });
      const amountPaidBefore = agg._sum.amount ?? 0;

      try {
        assertWithinBalance({
          totalAmount: order.totalAmount,
          amountPaidBefore,
          incomingAmount: input.amount,
        });
      } catch (e) {
        if (e instanceof OverpaymentError) throw Conflict(e.message);
        throw e;
      }
      orderRef = order.reference;
    }

    const payment = await tx.payment.create({
      data: {
        organizationId: input.organizationId,
        customerId: customer.id,
        orderId: input.orderId ?? null,
        amount: input.amount,
        currency: org.currency,
        method: input.method,
        provider: input.provider ?? null,
        status: "CONFIRMED",
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        paidAt: input.paidAt ?? new Date(),
        recordedByUserId: input.actorUserId,
      },
    });

    if (input.orderId) {
      const rec = await recomputeOrderPayment(
        tx,
        input.organizationId,
        input.orderId,
      );
      balanceDue = rec.balanceDue;
    }

    await tx.customerActivity.create({
      data: {
        organizationId: input.organizationId,
        customerId: customer.id,
        type: "PAYMENT_RECORDED",
        title: orderRef
          ? `Paiement encaissé — ${orderRef}`
          : "Paiement encaissé",
        actorUserId: input.actorUserId,
        metadata: {
          paymentId: payment.id,
          orderId: input.orderId ?? null,
          amount: input.amount,
          method: input.method,
          balanceDue,
        },
      },
    });

    return { payment, balanceDue };
  }, TX_OPTS);

  await writeAuditLog({
    action: "PAYMENT_RECORDED",
    entityType: "payment",
    entityId: result.payment.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: {
      customerId: input.customerId,
      orderId: input.orderId ?? null,
      amount: input.amount,
      method: input.method,
      provider: input.provider ?? null,
    },
  });

  return { paymentId: result.payment.id, balanceDue: result.balanceDue };
}

// ─────────────────────────── Annuler un paiement ───────────────────────────

export type CancelPaymentInput = {
  organizationId: string;
  actorUserId: string;
  paymentId: string;
  reason?: string | null;
};

export async function cancelPayment(
  input: CancelPaymentInput,
): Promise<{ paymentId: string; balanceDue: number | null }> {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: input.paymentId, organizationId: input.organizationId },
      select: {
        id: true,
        status: true,
        orderId: true,
        customerId: true,
        amount: true,
      },
    });
    if (!payment) throw NotFound("Paiement introuvable dans cette entreprise.");
    if (payment.status === "CANCELLED") {
      throw Conflict("Ce paiement est déjà annulé.");
    }

    if (payment.orderId) await lockOrderRow(tx, payment.orderId);

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByUserId: input.actorUserId,
        cancellationReason: input.reason ?? null,
      },
    });

    let balanceDue: number | null = null;
    if (payment.orderId) {
      const rec = await recomputeOrderPayment(
        tx,
        input.organizationId,
        payment.orderId,
      );
      balanceDue = rec.balanceDue;
    }

    await tx.customerActivity.create({
      data: {
        organizationId: input.organizationId,
        customerId: payment.customerId,
        type: "PAYMENT_CANCELLED",
        title: "Paiement annulé",
        actorUserId: input.actorUserId,
        metadata: {
          paymentId: payment.id,
          orderId: payment.orderId,
          amount: payment.amount,
          reason: input.reason ?? null,
          balanceDue,
        },
      },
    });

    return { paymentId: payment.id, balanceDue };
  }, TX_OPTS);

  await writeAuditLog({
    action: "PAYMENT_CANCELLED",
    entityType: "payment",
    entityId: result.paymentId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { reason: input.reason ?? undefined },
  });

  return result;
}

// ─────────────────────────── Modifier l'échéance ───────────────────────────

export type UpdateDueDateInput = {
  organizationId: string;
  actorUserId: string;
  orderId: string;
  dueDate: Date | null;
};

export async function updateOrderDueDate(
  input: UpdateDueDateInput,
): Promise<{ orderId: string; paymentStatus: string }> {
  const status = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, organizationId: input.organizationId },
      select: { id: true, totalAmount: true, amountPaid: true },
    });
    if (!order) throw NotFound("Commande introuvable dans cette entreprise.");

    await lockOrderRow(tx, order.id);

    const paymentStatus = derivePaymentStatus(
      order.totalAmount,
      order.amountPaid,
      { creditMode: input.dueDate != null },
    );
    await tx.order.update({
      where: { id: order.id },
      data: { dueDate: input.dueDate, paymentStatus },
    });
    return paymentStatus;
  }, TX_OPTS);

  await writeAuditLog({
    action: "DUE_DATE_UPDATED",
    entityType: "order",
    entityId: input.orderId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { dueDate: input.dueDate?.toISOString() ?? null },
  });

  return { orderId: input.orderId, paymentStatus: status };
}
