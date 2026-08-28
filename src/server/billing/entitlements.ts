import "server-only";
import type { Feature } from "./features.ts";
import { PLAN_ORDER, PLAN_DEFS, type PlanDef } from "./plans.ts";
import { orgFeatureMap } from "./guard.ts";
import { getSubscriptionSummary, type SubscriptionSummary } from "./subscription-service.ts";
import { getUsageSnapshot, type UsageSnapshot } from "./usage-service.ts";

/** Vue « Offre & usage » pour l'organisation (§58). */
export type BillingOverview = {
  subscription: SubscriptionSummary;
  features: Record<Feature, boolean>;
  usage: UsageSnapshot[];
  plans: PlanDef[];
};

export async function getBillingOverview(
  organizationId: string,
  timeZone: string,
): Promise<BillingOverview> {
  const [subscription, features, usage] = await Promise.all([
    getSubscriptionSummary(organizationId),
    orgFeatureMap(organizationId),
    getUsageSnapshot(organizationId, timeZone),
  ]);
  return {
    subscription,
    features,
    usage,
    plans: PLAN_ORDER.map((c) => PLAN_DEFS[c]),
  };
}
