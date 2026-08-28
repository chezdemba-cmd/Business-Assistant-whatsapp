"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { actionOrgContext } from "./context";
import { runAction, formToObject } from "./runner";
import { Conflict, Forbidden, NotFound } from "@/server/errors";
import { canAccessCustomer, canActOnOrder } from "@/server/crm/scope";
import {
  recordPayment,
  cancelPayment,
  updateOrderDueDate,
} from "@/server/finance/payment-service";
import {
  recordPaymentSchema,
  cancelPaymentSchema,
  updateDueDateSchema,
} from "@/server/validation/schemas";
import type { ActionResult } from "@/lib/result";

function parseDay(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function revalidateFinance(opts: {
  orderId?: string | null;
  customerId?: string | null;
}) {
  revalidatePath("/debts");
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  revalidatePath("/orders");
  if (opts.orderId) revalidatePath(`/orders/${opts.orderId}`);
  if (opts.customerId) revalidatePath(`/customers/${opts.customerId}`);
}

type RecordPaymentResult = { paymentId: string; balanceDue: number | null };

export async function recordPaymentAction(
  _prev: ActionResult<RecordPaymentResult> | null,
  formData: FormData,
): Promise<ActionResult<RecordPaymentResult>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "debts.write",
      organizationId: raw.organizationId,
    });
    const input = recordPaymentSchema.parse(raw);

    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, organizationId: ctx.organization.id },
      select: { id: true, assignedToUserId: true },
    });
    if (!customer) throw NotFound("Client introuvable dans cette entreprise.");
    if (!canAccessCustomer(ctx.role, ctx.user.id, customer)) {
      throw Forbidden("Ce client ne relève pas de votre périmètre.");
    }

    if (input.orderId) {
      const order = await prisma.order.findFirst({
        where: { id: input.orderId, organizationId: ctx.organization.id },
        select: {
          id: true,
          customerId: true,
          createdByUserId: true,
          customer: { select: { assignedToUserId: true } },
        },
      });
      if (!order) throw NotFound("Commande introuvable dans cette entreprise.");
      if (order.customerId !== customer.id) {
        throw Conflict("Cette commande n'appartient pas à ce client.");
      }
      if (!canActOnOrder(ctx.role, ctx.user.id, order)) {
        throw Forbidden("Cette commande ne relève pas de votre périmètre.");
      }
    }

    const res = await recordPayment({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      customerId: customer.id,
      orderId: input.orderId ?? null,
      amount: input.amount,
      method: input.method,
      provider: input.provider ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      paidAt: parseDay(input.paidAt),
    });

    revalidateFinance({ orderId: input.orderId ?? null, customerId: customer.id });
    return res;
  });
}

export async function cancelPaymentAction(
  _prev: ActionResult<{ paymentId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ paymentId: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "debts.write",
      organizationId: raw.organizationId,
    });
    const input = cancelPaymentSchema.parse(raw);

    const payment = await prisma.payment.findFirst({
      where: { id: input.paymentId, organizationId: ctx.organization.id },
      select: {
        id: true,
        customerId: true,
        orderId: true,
        customer: { select: { assignedToUserId: true } },
        order: {
          select: {
            createdByUserId: true,
            customer: { select: { assignedToUserId: true } },
          },
        },
      },
    });
    if (!payment) throw NotFound("Paiement introuvable dans cette entreprise.");
    if (!canAccessCustomer(ctx.role, ctx.user.id, payment.customer)) {
      throw Forbidden("Ce paiement ne relève pas de votre périmètre.");
    }
    if (payment.order && !canActOnOrder(ctx.role, ctx.user.id, payment.order)) {
      throw Forbidden("Cette commande ne relève pas de votre périmètre.");
    }

    const res = await cancelPayment({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      paymentId: payment.id,
      reason: input.reason ?? null,
    });

    revalidateFinance({
      orderId: payment.orderId,
      customerId: payment.customerId,
    });
    return { paymentId: res.paymentId };
  });
}

export async function updateDueDateAction(
  _prev: ActionResult<{ orderId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ orderId: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "debts.write",
      organizationId: raw.organizationId,
    });
    const input = updateDueDateSchema.parse(raw);

    const order = await prisma.order.findFirst({
      where: { id: input.orderId, organizationId: ctx.organization.id },
      select: {
        id: true,
        customerId: true,
        createdByUserId: true,
        customer: { select: { assignedToUserId: true } },
      },
    });
    if (!order) throw NotFound("Commande introuvable dans cette entreprise.");
    if (!canActOnOrder(ctx.role, ctx.user.id, order)) {
      throw Forbidden("Cette commande ne relève pas de votre périmètre.");
    }

    await updateOrderDueDate({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      orderId: order.id,
      dueDate: parseDay(input.dueDate),
    });

    revalidateFinance({ orderId: order.id, customerId: order.customerId });
    return { orderId: order.id };
  });
}
