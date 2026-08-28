import "server-only";
import type { Role } from "@prisma/client";
import { Conflict } from "@/server/errors";
import { can } from "@/server/rbac/permissions";
import { createReminderCampaign } from "@/server/finance/reminder-service";
import { createCampaign } from "@/server/marketing/campaign-service";
import {
  assertPreparableAction,
  getRecommendation,
  markRecommendationActioned,
  markRecommendationPrepared,
} from "./recommendation-service";

/**
 * PREPARE : une recommandation prépare une action réversible puis renvoie vers
 * l'écran de validation. Elle n'EXÉCUTE jamais un envoi ou une action
 * irréversible (§19, §53). La confirmation finale reste sur l'écran cible.
 */

export type PrepareOutcome = { redirectTo: string; prepared: boolean };

function payloadOf(rec: { actionPayload: unknown }): Record<string, unknown> {
  const p = rec.actionPayload;
  return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

export async function prepareRecommendationAction(input: {
  organizationId: string;
  actorUserId: string;
  role: Role;
  recommendationId: string;
}): Promise<PrepareOutcome> {
  const rec = await getRecommendation(
    input.organizationId,
    input.recommendationId,
    input.role,
    input.actorUserId,
  );
  assertPreparableAction(rec.actionType);
  const payload = payloadOf(rec);

  switch (rec.actionType) {
    case "PREPARE_REMINDER": {
      if (!can(input.role, "debts.write")) {
        throw Conflict("Vous n'avez pas le droit de préparer une relance.");
      }
      const customerId = String(payload.customerId ?? "");
      const orderId = payload.orderId ? String(payload.orderId) : null;
      if (!customerId) throw Conflict("Client manquant sur la recommandation.");
      const campaign = await createReminderCampaign({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        ...(orderId ? { orderIds: [orderId] } : { customerIds: [customerId] }),
      });
      await markRecommendationPrepared(rec.id);
      return { redirectTo: `/reminders/${campaign.campaignId}`, prepared: true };
    }

    case "PREPARE_CAMPAIGN": {
      if (!can(input.role, "marketing.manage")) {
        throw Conflict("Vous n'avez pas le droit de préparer une campagne.");
      }
      const inactiveDays = Number(payload.inactiveDays ?? 60) || 60;
      const campaign = await createCampaign({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        name: "Réactivation clients inactifs",
        type: "CUSTOMER_REACTIVATION",
        audienceType: "INACTIVE_CUSTOMERS",
        audienceConfig: { inactiveDays },
        channel: "WHATSAPP",
      });
      await markRecommendationPrepared(rec.id);
      return { redirectTo: `/marketing/${campaign.id}`, prepared: true };
    }

    case "OPEN_CUSTOMER": {
      await markRecommendationActioned(rec.id);
      return { redirectTo: `/customers/${String(payload.customerId ?? "")}`, prepared: false };
    }
    case "OPEN_ORDER": {
      await markRecommendationActioned(rec.id);
      return {
        redirectTo: payload.orderId ? `/orders/${String(payload.orderId)}` : "/orders",
        prepared: false,
      };
    }
    case "OPEN_PRODUCT": {
      await markRecommendationActioned(rec.id);
      return { redirectTo: `/catalog/${String(payload.productId ?? "")}`, prepared: false };
    }
    default:
      throw Conflict("Action non prise en charge.");
  }
}
