import "server-only";
import type {
  MarketingAudienceType,
  MarketingCampaignType,
  MarketingChannel,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { Conflict, Forbidden, NotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import { getEnv } from "@/lib/env";
import { getActiveConnectionForOrg } from "@/server/whatsapp/connection-service";
import { sendText, sendTemplate } from "@/server/whatsapp/message-service";
import { isCustomerServiceWindowOpen } from "@/server/whatsapp/service-window";
import { requireFeature } from "@/server/billing/guard";
import { assertDemoExternalSendAllowed } from "@/server/demo/guard";
import { checkUsageLimit, recordUsage } from "@/server/billing/usage-service";
import { limitReachedMessage } from "@/server/billing/limits";
import { PlanLimit } from "@/server/errors";
import type { AudienceConfig } from "./audience-rules";
import { resolveAudience } from "./audience-service";
import {
  defaultCampaignMessage,
  renderCampaignMessage,
  validateCampaignMessage,
} from "./content";

/**
 * Cycle de vie d'une campagne marketing :
 *   DRAFT → (preview audience) → READY (approuvée) → SENDING → SENT / PARTIAL / FAILED
 *
 * Règles dures :
 *   - jamais d'envoi sans approbation humaine explicite (§24)
 *   - opt-out toujours exclu (via `resolveAudience`) (§29)
 *   - dans la fenêtre 24 h : texte de session ; hors fenêtre : uniquement un
 *     template approuvé, sinon l'item est SAUTÉ, pas envoyé (§25, §52, §69)
 *   - idempotence par (campaignId, customerId) : un retry ne renvoie pas (§30, §68)
 *   - réutilise le service WhatsApp existant — aucun nouveau client Meta (§51)
 */

export async function createCampaign(input: {
  organizationId: string;
  actorUserId: string;
  name: string;
  type: MarketingCampaignType;
  audienceType: MarketingAudienceType;
  audienceConfig: AudienceConfig;
  message?: string | null;
  channel?: MarketingChannel;
  templateName?: string | null;
  templateLang?: string | null;
}): Promise<{ id: string }> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { name: true },
  });
  const message = validateCampaignMessage(
    input.message?.trim() || defaultCampaignMessage(input.type, org.name),
  );

  const campaign = await prisma.marketingCampaign.create({
    data: {
      organizationId: input.organizationId,
      name: input.name.trim() || "Campagne sans nom",
      type: input.type,
      status: "DRAFT",
      audienceType: input.audienceType,
      audienceConfig: input.audienceConfig as Prisma.InputJsonValue,
      message,
      channel: input.channel ?? "WHATSAPP",
      templateName: input.templateName?.trim() || null,
      templateLang: input.templateLang?.trim() || null,
      createdByUserId: input.actorUserId,
    },
    select: { id: true },
  });

  await writeAuditLog({
    action: "MARKETING_CAMPAIGN_CREATED",
    entityType: "marketing_campaign",
    entityId: campaign.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { type: input.type, audienceType: input.audienceType },
  });
  return campaign;
}

export async function getCampaign(organizationId: string, campaignId: string) {
  const c = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, organizationId },
    include: {
      items: {
        include: { customer: { select: { displayName: true } } },
        orderBy: { createdAt: "asc" },
        take: 500,
      },
      createdBy: { select: { firstName: true, lastName: true } },
      approvedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!c) throw NotFound("Campagne introuvable.");
  return c;
}

export async function listCampaigns(organizationId: string, take = 50) {
  return prisma.marketingCampaign.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take,
    include: { _count: { select: { items: true } } },
  });
}

// ─────────────────────────── Aperçu (§27) ───────────────────────────

export type CampaignPreview = {
  audienceLabel: string;
  includedCount: number;
  excludedOptOutCount: number;
  excludedUnreachableCount: number;
  totalMatched: number;
  capped: boolean;
  channel: MarketingChannel;
  templateName: string | null;
  /** true si un template est requis pour une partie de l'audience (hors fenêtre). */
  templateMayBeRequired: boolean;
  sampleIncluded: Array<{ id: string; name: string; message: string }>;
  sampleExcludedOptOut: string[];
};

export async function previewCampaign(
  organizationId: string,
  campaignId: string,
  now: Date = new Date(),
): Promise<CampaignPreview> {
  const c = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, organizationId },
  });
  if (!c) throw NotFound("Campagne introuvable.");

  const audience = await resolveAudience({
    organizationId,
    audienceType: c.audienceType,
    config: (c.audienceConfig ?? {}) as AudienceConfig,
    now,
  });

  return {
    audienceLabel: audience.label,
    includedCount: audience.included.length,
    excludedOptOutCount: audience.excludedOptOut.length,
    excludedUnreachableCount: audience.excludedUnreachable.length,
    totalMatched: audience.totalMatched,
    capped: audience.capped,
    channel: c.channel,
    templateName: c.templateName,
    templateMayBeRequired: true,
    sampleIncluded: audience.included.slice(0, 10).map((cust) => ({
      id: cust.id,
      name: cust.displayName,
      message: renderCampaignMessage(c.message, cust.displayName),
    })),
    sampleExcludedOptOut: audience.excludedOptOut.slice(0, 10).map((x) => x.displayName),
  };
}

// ─────────────────────────── Approbation (§24) ───────────────────────────

export async function approveCampaign(input: {
  organizationId: string;
  actorUserId: string;
  campaignId: string;
}): Promise<{ id: string; status: "READY" }> {
  const c = await prisma.marketingCampaign.findFirst({
    where: { id: input.campaignId, organizationId: input.organizationId },
    select: { id: true, status: true, message: true },
  });
  if (!c) throw NotFound("Campagne introuvable.");
  if (!["DRAFT", "READY"].includes(c.status)) {
    throw Conflict("Seule une campagne en brouillon peut être approuvée.");
  }
  validateCampaignMessage(c.message);

  await prisma.marketingCampaign.update({
    where: { id: c.id },
    data: { status: "READY", approvedByUserId: input.actorUserId, approvedAt: new Date() },
  });
  await writeAuditLog({
    action: "MARKETING_CAMPAIGN_APPROVED",
    entityType: "marketing_campaign",
    entityId: c.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
  });
  return { id: c.id, status: "READY" };
}

export async function cancelCampaign(input: {
  organizationId: string;
  actorUserId: string;
  campaignId: string;
}): Promise<{ id: string }> {
  const c = await prisma.marketingCampaign.findFirst({
    where: { id: input.campaignId, organizationId: input.organizationId },
    select: { id: true, status: true },
  });
  if (!c) throw NotFound("Campagne introuvable.");
  if (["SENT", "SENDING"].includes(c.status)) {
    throw Conflict("Une campagne en cours ou envoyée ne peut plus être annulée.");
  }
  await prisma.marketingCampaign.update({
    where: { id: c.id },
    data: { status: "CANCELLED" },
  });
  return { id: c.id };
}

// ─────────────────────────── Envoi (§24, §25, §30, §51, §52) ───────────────────────────

export type SendResult = {
  campaignId: string;
  status: string;
  sent: number;
  skipped: number;
  failed: number;
  total: number;
};

export async function sendCampaign(input: {
  organizationId: string;
  actorUserId: string;
  campaignId: string;
  now?: Date;
}): Promise<SendResult> {
  const now = input.now ?? new Date();
  const c = await prisma.marketingCampaign.findFirst({
    where: { id: input.campaignId, organizationId: input.organizationId },
  });
  if (!c) throw NotFound("Campagne introuvable.");
  if (c.channel !== "WHATSAPP") {
    throw Conflict("Seul le canal WhatsApp est disponible dans cette version.");
  }
  if (!["READY", "SENDING", "PARTIAL"].includes(c.status)) {
    throw Conflict(
      c.status === "DRAFT"
        ? "Approuvez la campagne avant de l'envoyer."
        : "Cette campagne ne peut pas être envoyée dans son état actuel.",
    );
  }

  // Phase 8 — feature gating + plafond mensuel d'envois (§13, §20, §21).
  await requireFeature(input.organizationId, "MARKETING");
  // Staging/démo — pas d'envoi externe réel depuis une organisation `isDemo`.
  await assertDemoExternalSendAllowed(input.organizationId, "l'envoi d'une campagne");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { timezone: true },
  });

  const connection = await getActiveConnectionForOrg(input.organizationId);
  if (!connection) {
    throw Conflict("Aucun numéro WhatsApp connecté. Vérifiez Paramètres → WhatsApp.");
  }

  // 1) Matérialiser l'audience en items (idempotent).
  const audience = await resolveAudience({
    organizationId: input.organizationId,
    audienceType: c.audienceType,
    config: (c.audienceConfig ?? {}) as AudienceConfig,
    now,
  });

  const cap = getEnv().MARKETING_MAX_RECIPIENTS;
  const targets = audience.included;
  if (cap > 0 && targets.length > cap) {
    throw Forbidden(
      `L'audience (${targets.length}) dépasse le plafond autorisé (${cap}). Affinez les critères.`,
    );
  }

  const usage = await checkUsageLimit(input.organizationId, "MARKETING_SENDS", {
    amount: targets.length,
    timeZone: org.timezone,
    now,
  });
  if (!usage.allowed) throw PlanLimit(limitReachedMessage(usage));

  await prisma.marketingCampaign.update({
    where: { id: c.id },
    data: { status: "SENDING" },
  });

  for (const cust of targets) {
    await prisma.marketingCampaignItem.upsert({
      where: { campaignId_customerId: { campaignId: c.id, customerId: cust.id } },
      create: {
        organizationId: input.organizationId,
        campaignId: c.id,
        customerId: cust.id,
        messageSnapshot: renderCampaignMessage(c.message, cust.displayName),
        status: "PENDING",
      },
      update: {}, // déjà présent → on ne touche pas (idempotence §30)
    });
  }

  // 2) Envoyer uniquement les items PENDING.
  const pending = await prisma.marketingCampaignItem.findMany({
    where: { campaignId: c.id, status: "PENDING" },
    include: { customer: { select: { displayName: true, phone: true } } },
  });

  for (const item of pending) {
    const waId = (item.customer.phone ?? "").replace(/[^\d]/g, "");
    if (!waId) {
      await markItem(item.id, "SKIPPED", { errorCode: "NO_PHONE" });
      continue;
    }
    // Fenêtre 24 h : dernier message ENTRANT du client sur cette connexion.
    const conv = await prisma.conversation.findFirst({
      where: {
        organizationId: input.organizationId,
        whatsappConnectionId: connection.id,
        customerId: item.customerId,
      },
      orderBy: { lastInboundAt: "desc" },
      select: { lastInboundAt: true },
    });
    const windowOpen = isCustomerServiceWindowOpen(conv?.lastInboundAt ?? null, now);

    try {
      let result;
      if (windowOpen) {
        result = await sendText(connection, waId, item.messageSnapshot);
      } else if (c.templateName) {
        result = await sendTemplate(connection, waId, {
          name: c.templateName,
          languageCode: c.templateLang || "fr",
          components: [
            { type: "body", parameters: [{ type: "text", text: item.customer.displayName }] },
          ],
        });
      } else {
        // Hors fenêtre + aucun template compatible → envoi BLOQUÉ (§25, §69).
        await markItem(item.id, "SKIPPED", { errorCode: "OUT_OF_WINDOW_NO_TEMPLATE" });
        continue;
      }

      if (result.ok) {
        await markItem(item.id, "SENT", { externalMessageId: result.externalMessageId, sentAt: now });
      } else {
        await markItem(item.id, "FAILED", { errorCode: result.errorCode ?? "SEND_FAILED" });
      }
    } catch (err) {
      await markItem(item.id, "FAILED", {
        errorCode: err instanceof Error ? err.message.slice(0, 60) : "SEND_ERROR",
      });
    }
  }

  // 3) Statut final + stats.
  const counts = await prisma.marketingCampaignItem.groupBy({
    by: ["status"],
    where: { campaignId: c.id },
    _count: { _all: true },
  });
  const stat = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0;
  const sent = stat("SENT");
  const skipped = stat("SKIPPED");
  const failed = stat("FAILED");
  const total = counts.reduce((a, x) => a + x._count._all, 0);
  const finalStatus =
    sent === 0 ? (total === 0 ? "READY" : "FAILED") : sent === total ? "SENT" : "PARTIAL";

  await prisma.marketingCampaign.update({
    where: { id: c.id },
    data: {
      status: finalStatus,
      sentAt: sent > 0 ? now : null,
      stats: { total, sent, skipped, failed },
    },
  });

  await writeAuditLog({
    action: "MARKETING_CAMPAIGN_SENT",
    entityType: "marketing_campaign",
    entityId: c.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { total, sent, skipped, failed, status: finalStatus },
  });
  if (sent > 0) {
    await recordUsage(input.organizationId, "MARKETING_SENDS", sent, org.timezone, now);
  }

  return { campaignId: c.id, status: finalStatus, sent, skipped, failed, total };
}

async function markItem(
  id: string,
  status: "SENT" | "FAILED" | "SKIPPED",
  extra: { externalMessageId?: string; errorCode?: string; sentAt?: Date } = {},
): Promise<void> {
  await prisma.marketingCampaignItem.update({
    where: { id },
    data: {
      status,
      externalMessageId: extra.externalMessageId ?? null,
      errorCode: extra.errorCode ?? null,
      sentAt: extra.sentAt ?? null,
    },
  });
}

// ─────────────────────────── Opt-out (§29) ───────────────────────────

export async function optOutCustomer(input: {
  organizationId: string;
  actorUserId: string;
  customerId: string;
}): Promise<{ id: string }> {
  const cust = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: input.organizationId },
    select: { id: true, marketingOptIn: true },
  });
  if (!cust) throw NotFound("Client introuvable.");

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: cust.id },
      data: { marketingOptIn: false, marketingOptOutAt: new Date() },
    }),
    // Retire le client des campagnes non encore envoyées.
    prisma.marketingCampaignItem.updateMany({
      where: { organizationId: input.organizationId, customerId: cust.id, status: "PENDING" },
      data: { status: "SKIPPED", errorCode: "OPTED_OUT" },
    }),
  ]);

  await writeAuditLog({
    action: "MARKETING_OPT_OUT",
    entityType: "customer",
    entityId: cust.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
  });
  return { id: cust.id };
}

export async function optInCustomer(input: {
  organizationId: string;
  actorUserId: string;
  customerId: string;
}): Promise<{ id: string }> {
  const cust = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!cust) throw NotFound("Client introuvable.");
  await prisma.customer.update({
    where: { id: cust.id },
    data: { marketingOptIn: true, marketingOptInAt: new Date(), marketingOptOutAt: null },
  });
  return { id: cust.id };
}
