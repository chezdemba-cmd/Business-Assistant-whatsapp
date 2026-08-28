import "server-only";
import { FeatureLocked } from "@/server/errors";
import {
  hasFeature,
  featureUnavailableMessage,
  FEATURES,
  type Feature,
} from "./features.ts";
import { getSubscriptionContext } from "./subscription-service.ts";

/**
 * Barrières de plan côté serveur. À appeler en complément du RBAC, avant
 * d'exposer / d'exécuter une fonctionnalité gated (§20).
 */

export async function orgHasFeature(
  organizationId: string,
  feature: Feature,
): Promise<boolean> {
  const ctx = await getSubscriptionContext(organizationId);
  return hasFeature(
    { planCode: ctx.planCode, status: ctx.status, featureOverrides: ctx.featureOverrides },
    feature,
  );
}

export async function requireFeature(
  organizationId: string,
  feature: Feature,
): Promise<void> {
  if (!(await orgHasFeature(organizationId, feature))) {
    throw FeatureLocked(featureUnavailableMessage(feature));
  }
}

/** Carte complète des features pour une organisation (UI, admin). */
export async function orgFeatureMap(
  organizationId: string,
): Promise<Record<Feature, boolean>> {
  const ctx = await getSubscriptionContext(organizationId);
  const sub = { planCode: ctx.planCode, status: ctx.status, featureOverrides: ctx.featureOverrides };
  const out = {} as Record<Feature, boolean>;
  for (const f of FEATURES) out[f] = hasFeature(sub, f);
  return out;
}
