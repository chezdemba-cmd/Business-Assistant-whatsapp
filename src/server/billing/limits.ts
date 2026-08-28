import type { PlanCode, SubscriptionStatus, UsageMetric } from "@prisma/client";
import { LIMIT_PERIOD, PLAN_DEFS } from "./plans.ts";

/**
 * Contrôle de coût fournisseur — PUR (§13, §21). `resolveLimit` donne la limite
 * effective (plan + overrides), `checkAgainstLimit` dit si l'appel passe.
 * `null` = illimité.
 */

export type LimitSubscription = {
  planCode: PlanCode;
  status: SubscriptionStatus;
  limitOverrides?: Partial<Record<UsageMetric, number | null>> | null;
};

export function limitPeriod(metric: UsageMetric): "DAY" | "MONTH" {
  return LIMIT_PERIOD[metric];
}

/** Limite effective pour une métrique (null = illimité). */
export function resolveLimit(
  sub: LimitSubscription | null,
  metric: UsageMetric,
): number | null {
  if (!sub) return 0; // pas d'abonnement → rien
  if (sub.status === "SUSPENDED" || sub.status === "CANCELLED") return 0;
  const override = sub.limitOverrides?.[metric];
  if (override === null) return null;
  if (typeof override === "number") return Math.max(0, override);
  const planLimit = PLAN_DEFS[sub.planCode].limits[metric];
  if (planLimit === null) return null;
  return typeof planLimit === "number" ? planLimit : 0;
}

export type LimitCheck = {
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  metric: UsageMetric;
  reason?: "OVER_LIMIT" | "NO_SUBSCRIPTION";
};

/**
 * `used` = consommation déjà enregistrée sur la période. `amount` = ce que
 * l'appel s'apprête à consommer (≥ 1). N'ENGAGE aucune dépense fournisseur si
 * le résultat est `allowed:false`.
 */
export function checkAgainstLimit(
  sub: LimitSubscription | null,
  metric: UsageMetric,
  used: number,
  amount = 1,
): LimitCheck {
  const limit = resolveLimit(sub, metric);
  if (limit === null) {
    return { allowed: true, limit: null, used, remaining: null, metric };
  }
  const allowed = used + amount <= limit;
  return {
    allowed,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    metric,
    ...(allowed ? {} : { reason: sub ? "OVER_LIMIT" : "NO_SUBSCRIPTION" }),
  };
}

export function limitReachedMessage(check: LimitCheck): string {
  const label: Record<UsageMetric, string> = {
    AI_REQUESTS: "requêtes Djeli IA",
    AI_TOKENS: "jetons IA",
    VOICE_SECONDS: "secondes de transcription",
    WHATSAPP_MESSAGES: "messages WhatsApp",
    LANGUAGE_RESOLVES: "appels Language Core",
    MARKETING_SENDS: "envois marketing",
  };
  const per = limitPeriod(check.metric) === "DAY" ? "aujourd'hui" : "ce mois-ci";
  return `Vous avez atteint votre quota de ${label[check.metric]} ${per} (${check.limit}). Il se réinitialise à la prochaine période, ou passez à une offre supérieure.`;
}
