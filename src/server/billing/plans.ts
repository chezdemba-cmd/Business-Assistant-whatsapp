import type { PlanCode, UsageMetric } from "@prisma/client";

/**
 * Catalogue de plans — PUR. Valeurs par DÉFAUT appliquées quand la ligne `Plan`
 * en base n'a pas le champ (les limites/features réelles sont configurables sans
 * migration via `Plan.limits` / `Plan.features` et
 * `Subscription.limitOverrides` / `featureOverrides`).
 *
 * Limite = nombre pour une période (voir `LIMIT_PERIOD`). `null` = illimité.
 */

export const FEATURES = [
  "WHATSAPP",
  "AI",
  "VOICE",
  "AUTOMATIONS",
  "MARKETING",
  "LANGUAGE_ADVANCED",
  "TEAM",
] as const;

export type Feature = (typeof FEATURES)[number];

/** Période de comptage de chaque métrique d'usage. */
export const LIMIT_PERIOD: Record<UsageMetric, "DAY" | "MONTH"> = {
  AI_REQUESTS: "DAY",
  AI_TOKENS: "MONTH",
  VOICE_SECONDS: "MONTH",
  WHATSAPP_MESSAGES: "DAY",
  LANGUAGE_RESOLVES: "DAY",
  MARKETING_SENDS: "MONTH",
};

export type PlanDef = {
  code: PlanCode;
  name: string;
  description: string;
  priceMonthly: number; // plus petite unité de la devise (0 = gratuit / sur devis)
  currency: string;
  limits: Partial<Record<UsageMetric, number | null>>;
  features: Record<Feature, boolean>;
  sortOrder: number;
};

const ALL_OFF: Record<Feature, boolean> = {
  WHATSAPP: false,
  AI: false,
  VOICE: false,
  AUTOMATIONS: false,
  MARKETING: false,
  LANGUAGE_ADVANCED: false,
  TEAM: false,
};

export const PLAN_DEFS: Record<PlanCode, PlanDef> = {
  STARTER: {
    code: "STARTER",
    name: "Starter",
    description:
      "Pour démarrer seul : catalogue et clients, conversations et IA en volume limité.",
    priceMonthly: 0,
    currency: "XOF",
    sortOrder: 1,
    features: { ...ALL_OFF, WHATSAPP: true, AI: true },
    limits: {
      AI_REQUESTS: 40,
      AI_TOKENS: 150_000,
      VOICE_SECONDS: 0,
      WHATSAPP_MESSAGES: 150,
      LANGUAGE_RESOLVES: 500,
      MARKETING_SENDS: 0,
    },
  },
  BUSINESS: {
    code: "BUSINESS",
    name: "Business",
    description:
      "Pour une équipe : WhatsApp, IA, Voice, automatisations et marketing.",
    priceMonthly: 0,
    currency: "XOF",
    sortOrder: 2,
    features: {
      ...ALL_OFF,
      WHATSAPP: true,
      AI: true,
      VOICE: true,
      AUTOMATIONS: true,
      MARKETING: true,
      TEAM: true,
    },
    limits: {
      AI_REQUESTS: 400,
      AI_TOKENS: 2_000_000,
      VOICE_SECONDS: 36_000,
      WHATSAPP_MESSAGES: 3_000,
      LANGUAGE_RESOLVES: 20_000,
      MARKETING_SENDS: 5_000,
    },
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    description:
      "Volumes élevés, Language Core avancé et analytics, support premium.",
    priceMonthly: 0,
    currency: "XOF",
    sortOrder: 3,
    features: {
      WHATSAPP: true,
      AI: true,
      VOICE: true,
      AUTOMATIONS: true,
      MARKETING: true,
      LANGUAGE_ADVANCED: true,
      TEAM: true,
    },
    limits: {
      AI_REQUESTS: null,
      AI_TOKENS: null,
      VOICE_SECONDS: null,
      WHATSAPP_MESSAGES: null,
      LANGUAGE_RESOLVES: null,
      MARKETING_SENDS: 50_000,
    },
  },
};

export const PLAN_ORDER: PlanCode[] = ["STARTER", "BUSINESS", "PRO"];

export function planDef(code: PlanCode): PlanDef {
  return PLAN_DEFS[code];
}
