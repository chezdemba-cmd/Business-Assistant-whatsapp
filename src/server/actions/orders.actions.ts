"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { actionOrgContext } from "./context";
import { runAction, formToObject } from "./runner";
import { Forbidden, NotFound } from "@/server/errors";
import { canAccessCustomer, canActOnOrder } from "@/server/crm/scope";
import {
  createOrder,
  updateOrderItems,
  transitionOrder,
} from "@/server/orders/order-service";
import {
  createOrderSchema,
  updateOrderItemsSchema,
  transitionOrderSchema,
} from "@/server/validation/schemas";
import type { ActionResult } from "@/lib/result";

function parseDeliveryDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createOrderAction(
  _prev: ActionResult<{ orderId: string; reference: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ orderId: string; reference: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "orders.write",
      organizationId: raw.organizationId,
    });
    const input = createOrderSchema.parse(raw);

    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, organizationId: ctx.organization.id },
      select: { id: true, assignedToUserId: true },
    });
    if (!customer) throw NotFound("Client introuvable dans cette entreprise.");
    if (!canAccessCustomer(ctx.role, ctx.user.id, customer)) {
      throw Forbidden("Ce client ne vous est pas assigné.");
    }

    const { orderId, reference } = await createOrder({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      customerId: customer.id,
      lines: input.items,
      discountAmount: input.discountAmount,
      deliveryFee: input.deliveryFee,
      notes: input.notes ?? null,
      deliveryAddress: input.deliveryAddress ?? null,
      deliveryArea: input.deliveryArea ?? null,
      requestedDeliveryAt: parseDeliveryDate(input.requestedDeliveryAt),
      source: "MANUAL",
    });

    revalidatePath("/orders");
    revalidatePath("/stock");
    revalidatePath("/catalog");
    revalidatePath("/dashboard");
    revalidatePath(`/customers/${customer.id}`);
    return { orderId, reference };
  });
}

export async function updateOrderItemsAction(
  _prev: ActionResult<{ orderId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ orderId: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "orders.write",
      organizationId: raw.organizationId,
    });
    const input = updateOrderItemsSchema.parse(raw);

    const order = await prisma.order.findFirst({
      where: { id: input.orderId, organizationId: ctx.organization.id },
      select: {
        id: true,
        createdByUserId: true,
        customerId: true,
        customer: { select: { assignedToUserId: true } },
      },
    });
    if (!order) throw NotFound("Commande introuvable dans cette entreprise.");
    if (!canActOnOrder(ctx.role, ctx.user.id, order)) {
      throw Forbidden("Cette commande ne relève pas de votre périmètre.");
    }

    await updateOrderItems({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      orderId: order.id,
      lines: input.items,
      discountAmount: input.discountAmount,
      deliveryFee: input.deliveryFee,
      notes: input.notes ?? null,
    });

    revalidatePath("/orders");
    revalidatePath(`/orders/${order.id}`);
    revalidatePath("/stock");
    revalidatePath("/catalog");
    return { orderId: order.id };
  });
}

export async function transitionOrderAction(
  _prev: ActionResult<{ status: OrderStatus }> | null,
  formData: FormData,
): Promise<ActionResult<{ status: OrderStatus }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "orders.write",
      organizationId: raw.organizationId,
    });
    const input = transitionOrderSchema.parse(raw);

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

    const { status } = await transitionOrder({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      orderId: order.id,
      to: input.to,
      reason: input.reason ?? null,
      source: "MANUAL",
    });

    revalidatePath("/orders");
    revalidatePath(`/orders/${order.id}`);
    revalidatePath(`/customers/${order.customerId}`);
    revalidatePath("/stock");
    revalidatePath("/catalog");
    revalidatePath("/dashboard");
    return { status };
  });
}
