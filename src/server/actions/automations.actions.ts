"use server";

import { revalidatePath } from "next/cache";
import { actionOrgContext } from "./context";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";
import {
  runAutomationsForOrganization,
  setAutomationRuleEnabled,
  updateAutomationRuleConfig,
} from "@/server/automations/automation-service";
import {
  dismissRecommendation,
  markRecommendationsViewed,
} from "@/server/automations/recommendation-service";
import { prepareRecommendationAction } from "@/server/automations/recommendation-actions";
import { markNotificationsRead } from "@/server/notifications/notification-service";

function revalidateAll(): void {
  revalidatePath("/automations");
  revalidatePath("/recommendations");
  revalidatePath("/dashboard");
  revalidatePath("/ai");
}

export async function runAutomationsAction(
  _prev: ActionResult<{ created: number; updated: number; expired: number }> | null,
): Promise<ActionResult<{ created: number; updated: number; expired: number }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "automations.manage" });
    const res = await runAutomationsForOrganization({
      organizationId: ctx.organization.id,
      timezone: ctx.organization.timezone,
      currency: ctx.organization.currency,
      actorUserId: ctx.user.id,
    });
    revalidateAll();
    return { created: res.created, updated: res.updated, expired: res.expired };
  });
}

export async function toggleAutomationRuleAction(
  _prev: ActionResult<{ id: string; enabled: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; enabled: boolean }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "automations.manage" });
    const raw = formToObject(formData);
    const res = await setAutomationRuleEnabled({
      organizationId: ctx.organization.id,
      ruleId: raw.ruleId ?? "",
      enabled: raw.enabled === "1" || raw.enabled === "true",
      actorUserId: ctx.user.id,
    });
    revalidatePath("/automations");
    return res;
  });
}

export async function updateAutomationRuleConfigAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "automations.manage" });
    const raw = formToObject(formData);
    const config: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k === "ruleId") continue;
      const n = Number(v);
      if (Number.isFinite(n)) config[k] = n;
    }
    const res = await updateAutomationRuleConfig({
      organizationId: ctx.organization.id,
      ruleId: raw.ruleId ?? "",
      config,
      actorUserId: ctx.user.id,
    });
    revalidatePath("/automations");
    return res;
  });
}

export async function dismissRecommendationAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "recommendations.read" });
    const raw = formToObject(formData);
    const res = await dismissRecommendation({
      organizationId: ctx.organization.id,
      recommendationId: raw.recommendationId ?? "",
      actorUserId: ctx.user.id,
      role: ctx.role,
    });
    revalidateAll();
    return res;
  });
}

export async function prepareRecommendationActionAction(
  _prev: ActionResult<{ redirectTo: string; prepared: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string; prepared: boolean }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "recommendations.read" });
    const raw = formToObject(formData);
    const res = await prepareRecommendationAction({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      role: ctx.role,
      recommendationId: raw.recommendationId ?? "",
    });
    revalidateAll();
    return res;
  });
}

export async function markRecommendationsViewedAction(
  _prev: ActionResult<{ ok: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "recommendations.read" });
    const raw = formToObject(formData);
    const ids = (raw.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    await markRecommendationsViewed(ctx.organization.id, ids);
    return { ok: true as const };
  });
}

export async function markNotificationsReadAction(
  _prev: ActionResult<{ count: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "organization.read" });
    const raw = formToObject(formData);
    const ids = raw.ids ? raw.ids.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const count = await markNotificationsRead(
      ctx.organization.id,
      ctx.role,
      ctx.user.id,
      ids,
    );
    revalidatePath("/dashboard");
    return { count };
  });
}
