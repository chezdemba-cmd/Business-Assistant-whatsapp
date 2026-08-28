"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { actionOrgContext } from "./context";
import { runAction, formToObject } from "./runner";
import { Forbidden, NotFound } from "@/server/errors";
import { canActOnOrder, canAccessCustomer, canSeeAllCrm } from "@/server/crm/scope";
import {
  createReminderCampaign,
  sendReminderCampaign,
  cancelReminderCampaign,
} from "@/server/finance/reminder-service";
import {
  createReminderCampaignSchema,
  campaignIdSchema,
} from "@/server/validation/schemas";
import type { ActionResult } from "@/lib/result";

function revalidateReminders(campaignId?: string) {
  revalidatePath("/reminders");
  revalidatePath("/debts");
  revalidatePath("/dashboard");
  if (campaignId) revalidatePath(`/reminders/${campaignId}`);
}

export async function createReminderCampaignAction(
  _prev: ActionResult<{ campaignId: string; itemCount: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ campaignId: string; itemCount: number }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "debts.write",
      organizationId: raw.organizationId,
    });
    const input = createReminderCampaignSchema.parse(raw);

    // Périmètre CRM : un SALES ne peut relancer que ses créances.
    if (!canSeeAllCrm(ctx.role)) {
      if (input.orderIds.length > 0) {
        const orders = await prisma.order.findMany({
          where: { id: { in: input.orderIds }, organizationId: ctx.organization.id },
          select: {
            id: true,
            createdByUserId: true,
            customer: { select: { assignedToUserId: true } },
          },
        });
        if (orders.length !== input.orderIds.length) {
          throw NotFound("Une créance sélectionnée est introuvable.");
        }
        for (const o of orders) {
          if (!canActOnOrder(ctx.role, ctx.user.id, o)) {
            throw Forbidden("Une créance sélectionnée hors de votre périmètre.");
          }
        }
      }
      if (input.customerIds.length > 0) {
        const customers = await prisma.customer.findMany({
          where: {
            id: { in: input.customerIds },
            organizationId: ctx.organization.id,
          },
          select: { id: true, assignedToUserId: true },
        });
        if (customers.length !== input.customerIds.length) {
          throw NotFound("Un client sélectionné est introuvable.");
        }
        for (const c of customers) {
          if (!canAccessCustomer(ctx.role, ctx.user.id, c)) {
            throw Forbidden("Un client sélectionné hors de votre périmètre.");
          }
        }
      }
    }

    const res = await createReminderCampaign({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      name: input.name ?? null,
      orderIds: input.orderIds,
      customerIds: input.customerIds,
    });

    revalidateReminders(res.campaignId);
    return res;
  });
}

export async function sendReminderCampaignAction(
  _prev: ActionResult<{ campaignId: string; sentCount: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ campaignId: string; sentCount: number }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "debts.write",
      organizationId: raw.organizationId,
    });
    const { campaignId } = campaignIdSchema.parse(raw);

    const res = await sendReminderCampaign({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      campaignId,
    });

    revalidateReminders(campaignId);
    return { campaignId: res.campaignId, sentCount: res.sentCount };
  });
}

export async function cancelReminderCampaignAction(
  _prev: ActionResult<{ campaignId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ campaignId: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "debts.write",
      organizationId: raw.organizationId,
    });
    const { campaignId } = campaignIdSchema.parse(raw);

    const res = await cancelReminderCampaign({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      campaignId,
    });

    revalidateReminders(campaignId);
    return res;
  });
}
