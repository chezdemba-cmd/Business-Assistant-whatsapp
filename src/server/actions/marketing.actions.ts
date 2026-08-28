"use server";

import { revalidatePath } from "next/cache";
import type { MarketingAudienceType, MarketingCampaignType } from "@prisma/client";
import { actionOrgContext } from "./context";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";
import type { AudienceConfig } from "@/server/marketing/audience-rules";
import {
  approveCampaign,
  cancelCampaign,
  createCampaign,
  optInCustomer,
  optOutCustomer,
  previewCampaign,
  sendCampaign,
  type CampaignPreview,
  type SendResult,
} from "@/server/marketing/campaign-service";

const CAMPAIGN_TYPES: MarketingCampaignType[] = [
  "CUSTOMER_REACTIVATION",
  "PROMOTION",
  "NEW_PRODUCT",
  "LOW_ACTIVITY",
  "CUSTOM",
];
const AUDIENCE_TYPES: MarketingAudienceType[] = [
  "INACTIVE_CUSTOMERS",
  "CUSTOMER_TYPE",
  "AREA",
  "PRODUCT_BUYERS",
  "ALL_OPTED_IN",
  "CUSTOM",
];

function parseAudienceConfig(raw: Record<string, string>): AudienceConfig {
  const cfg: AudienceConfig = {};
  if (raw.inactiveDays) cfg.inactiveDays = Number(raw.inactiveDays) || undefined;
  if (raw.customerType) cfg.customerType = raw.customerType;
  if (raw.area) cfg.area = raw.area;
  if (raw.productId) cfg.productId = raw.productId;
  if (raw.minSpent) cfg.minSpent = Number(raw.minSpent) || undefined;
  return cfg;
}

export async function createCampaignAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "marketing.manage" });
    const raw = formToObject(formData);
    const type = (CAMPAIGN_TYPES.includes(raw.type as MarketingCampaignType)
      ? raw.type
      : "CUSTOMER_REACTIVATION") as MarketingCampaignType;
    const audienceType = (AUDIENCE_TYPES.includes(raw.audienceType as MarketingAudienceType)
      ? raw.audienceType
      : "INACTIVE_CUSTOMERS") as MarketingAudienceType;

    const res = await createCampaign({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      name: raw.name ?? "",
      type,
      audienceType,
      audienceConfig: parseAudienceConfig(raw),
      message: raw.message || null,
      channel: "WHATSAPP",
      templateName: raw.templateName || null,
      templateLang: raw.templateLang || null,
    });
    revalidatePath("/marketing");
    return res;
  });
}

export async function previewCampaignAction(
  _prev: ActionResult<CampaignPreview> | null,
  formData: FormData,
): Promise<ActionResult<CampaignPreview>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "marketing.read" });
    const raw = formToObject(formData);
    return previewCampaign(ctx.organization.id, raw.campaignId ?? "");
  });
}

export async function approveCampaignAction(
  _prev: ActionResult<{ id: string; status: "READY" }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; status: "READY" }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "marketing.manage" });
    const raw = formToObject(formData);
    const res = await approveCampaign({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      campaignId: raw.campaignId ?? "",
    });
    revalidatePath(`/marketing/${res.id}`);
    revalidatePath("/marketing");
    return res;
  });
}

export async function sendCampaignAction(
  _prev: ActionResult<SendResult> | null,
  formData: FormData,
): Promise<ActionResult<SendResult>> {
  return runAction(async () => {
    // §24 : l'envoi effectif exige la permission dédiée `marketing.send`.
    const ctx = await actionOrgContext({ permission: "marketing.send" });
    const raw = formToObject(formData);
    const res = await sendCampaign({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      campaignId: raw.campaignId ?? "",
    });
    revalidatePath(`/marketing/${res.campaignId}`);
    revalidatePath("/marketing");
    return res;
  });
}

export async function cancelCampaignAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "marketing.manage" });
    const raw = formToObject(formData);
    const res = await cancelCampaign({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      campaignId: raw.campaignId ?? "",
    });
    revalidatePath("/marketing");
    return res;
  });
}

export async function optOutCustomerAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "customers.write" });
    const raw = formToObject(formData);
    const res = await optOutCustomer({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      customerId: raw.customerId ?? "",
    });
    revalidatePath(`/customers/${res.id}`);
    return res;
  });
}

export async function optInCustomerAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "customers.write" });
    const raw = formToObject(formData);
    const res = await optInCustomer({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      customerId: raw.customerId ?? "",
    });
    revalidatePath(`/customers/${res.id}`);
    return res;
  });
}
