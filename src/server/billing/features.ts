import type { PlanCode, SubscriptionStatus } from "@prisma/client";
import { PLAN_DEFS, type Feature } from "./plans.ts";

export { FEATURES, type Feature } from "./plans.ts";

/**
 * Feature gating central — PUR (§20). Un seul point de vérité :
 * `hasFeature(subscription, feature)`. Interdiction de disperser des
 * `if (plan === "PRO")` dans le code.
 */

export type SubscriptionLike = {
  planCode: PlanCode;
  status: SubscriptionStatus;
  featureOverrides?: Partial<Record<Feature, boolean>> | null;
};

/** Statuts qui donnent accès aux fonctionnalités du plan (TRIAL inclus). */
const ENTITLED: ReadonlySet<SubscriptionStatus> = new Set(["TRIAL", "ACTIVE", "PAST_DUE"]);

export function planHasFeature(planCode: PlanCode, feature: Feature): boolean {
  return PLAN_DEFS[planCode].features[feature] === true;
}

/**
 * L'organisation a-t-elle accès à `feature` ?
 * - abonnement CANCELLED / SUSPENDED → aucune feature payante
 * - override explicite du Subscription prioritaire (négociation pilote)
 * - sinon : la matrice du plan
 */
export function hasFeature(sub: SubscriptionLike | null, feature: Feature): boolean {
  if (!sub) return false;
  if (!ENTITLED.has(sub.status)) return false;
  const override = sub.featureOverrides?.[feature];
  if (typeof override === "boolean") return override;
  return planHasFeature(sub.planCode, feature);
}

/** Message standard quand une feature est absente du plan. */
export function featureUnavailableMessage(feature: Feature): string {
  const label: Record<Feature, string> = {
    WHATSAPP: "WhatsApp Business",
    AI: "Djeli IA",
    VOICE: "Djeli Voice",
    AUTOMATIONS: "les automatisations",
    MARKETING: "les campagnes marketing",
    LANGUAGE_ADVANCED: "le Language Core avancé",
    TEAM: "la gestion d'équipe",
  };
  return `${label[feature]} n'est pas inclus dans votre offre actuelle. Passez à une offre supérieure pour l'activer.`;
}
