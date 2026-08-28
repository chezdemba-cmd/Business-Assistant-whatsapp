"use server";

import { revalidatePath } from "next/cache";
import type { FeedbackCategory, SupportTicketType } from "@prisma/client";
import { actionOrgContext } from "./context";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";
import {
  createSupportTicket,
  submitFeedback,
} from "@/server/support/support-service";

const TICKET_TYPES: SupportTicketType[] = [
  "BUG",
  "QUESTION",
  "BILLING",
  "WHATSAPP",
  "AI",
  "VOICE",
  "OTHER",
];
const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  "BUG",
  "SUGGESTION",
  "AI",
  "VOICE",
  "WHATSAPP",
  "OTHER",
];

export async function createSupportTicketAction(
  _p: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "organization.read" });
    const raw = formToObject(formData);
    const type = (TICKET_TYPES.includes(raw.type as SupportTicketType)
      ? raw.type
      : "OTHER") as SupportTicketType;
    if (!raw.subject?.trim() || !raw.body?.trim()) {
      throw new Error("Sujet et description sont requis.");
    }
    const res = await createSupportTicket({
      organizationId: ctx.organization.id,
      openedByUserId: ctx.user.id,
      type,
      subject: raw.subject,
      body: raw.body,
      contactEmail: raw.contactEmail || ctx.user.email,
    });
    revalidatePath("/support");
    return res;
  });
}

export async function submitFeedbackAction(
  _p: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "organization.read" });
    const raw = formToObject(formData);
    const category = (FEEDBACK_CATEGORIES.includes(raw.category as FeedbackCategory)
      ? raw.category
      : "OTHER") as FeedbackCategory;
    if (!raw.message?.trim()) throw new Error("Votre message est vide.");
    return submitFeedback({
      organizationId: ctx.organization.id,
      authorUserId: ctx.user.id,
      category,
      message: raw.message,
      path: raw.path || null,
    });
  });
}
