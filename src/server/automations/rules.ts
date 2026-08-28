import type { AutomationRuleType } from "@prisma/client";

/**
 * Métadonnées des règles d'automatisation — PUR. Les seuils vivent dans
 * `config` (JSON) et sont fusionnés avec des valeurs par défaut ici.
 *
 * §58 : à la création d'une organisation, un jeu de règles par défaut est créé.
 * §59 : AUCUNE règle à effet externe automatique n'est activée par défaut.
 */

export type RuleConfig = Record<string, number | string | boolean>;

export type RuleMeta = {
  type: AutomationRuleType;
  name: string;
  description: string;
  /** État à la création d'une organisation. */
  defaultEnabled: boolean;
  /** Produit-elle une action à effet EXTERNE (envoi client) ? Toujours false ici. */
  externalEffect: false;
  defaultConfig: RuleConfig;
  defaultSchedule: string | null;
};

export const RULE_META: Record<AutomationRuleType, RuleMeta> = {
  LOW_STOCK: {
    type: "LOW_STOCK",
    name: "Stock faible",
    description:
      "Signale les produits dont le stock disponible est au niveau du seuil d'alerte ou en dessous, sans être en rupture.",
    defaultEnabled: true,
    externalEffect: false,
    defaultConfig: { cooldownHours: 24 },
    defaultSchedule: "daily@07:00",
  },
  OUT_OF_STOCK: {
    type: "OUT_OF_STOCK",
    name: "Rupture de stock",
    description: "Signale les produits dont le stock disponible est nul ou négatif.",
    defaultEnabled: true,
    externalEffect: false,
    defaultConfig: { cooldownHours: 12 },
    defaultSchedule: "daily@07:00",
  },
  OVERDUE_DEBT: {
    type: "OVERDUE_DEBT",
    name: "Créances en retard",
    description:
      "Signale les créances dont l'échéance est dépassée (paliers 7 / 30 / 60 / 90 jours).",
    defaultEnabled: true,
    externalEffect: false,
    defaultConfig: { minDaysOverdue: 7, cooldownHours: 48 },
    defaultSchedule: "daily@07:00",
  },
  PAYMENT_DUE_SOON: {
    type: "PAYMENT_DUE_SOON",
    name: "Échéance proche",
    description: "Prévient quand une créance arrive à échéance dans quelques jours.",
    defaultEnabled: false,
    externalEffect: false,
    defaultConfig: { daysBefore: 3, cooldownHours: 48 },
    defaultSchedule: "daily@07:00",
  },
  INACTIVE_CUSTOMER: {
    type: "INACTIVE_CUSTOMER",
    name: "Clients inactifs",
    description:
      "Signale les clients sans commande livrée depuis un seuil (30 / 60 / 90 jours).",
    // Prudent : OFF par défaut (§58).
    defaultEnabled: false,
    externalEffect: false,
    defaultConfig: { thresholdDays: 60, cooldownHours: 168 },
    defaultSchedule: "weekly@mon-07:00",
  },
  SALES_OPPORTUNITY: {
    type: "SALES_OPPORTUNITY",
    name: "Opportunités commerciales",
    description:
      "Client au rythme d'achat régulier qui n'a pas recommandé depuis une période inhabituelle.",
    defaultEnabled: false,
    externalEffect: false,
    defaultConfig: { overdueFactor: 1.5, cooldownHours: 168 },
    defaultSchedule: "weekly@mon-07:00",
  },
  ORDER_PENDING_CONFIRMATION: {
    type: "ORDER_PENDING_CONFIRMATION",
    name: "Commandes à confirmer",
    description:
      "Commande en attente de confirmation depuis trop longtemps.",
    defaultEnabled: true,
    externalEffect: false,
    defaultConfig: { hours: 2, cooldownHours: 6 },
    defaultSchedule: "hourly",
  },
  ORDER_STUCK: {
    type: "ORDER_STUCK",
    name: "Commandes bloquées",
    description:
      "Commande en préparation ou en livraison depuis trop longtemps.",
    defaultEnabled: true,
    externalEffect: false,
    defaultConfig: { hours: 48, cooldownHours: 24 },
    defaultSchedule: "daily@07:00",
  },
  ORDER_TO_PREPARE: {
    type: "ORDER_TO_PREPARE",
    name: "Commandes à préparer",
    description: "Commandes confirmées en attente de préparation.",
    defaultEnabled: true,
    externalEffect: false,
    defaultConfig: { cooldownHours: 6 },
    defaultSchedule: "hourly",
  },
  DAILY_SUMMARY: {
    type: "DAILY_SUMMARY",
    name: "Résumé quotidien",
    description:
      "Produit chaque jour le résumé de l'activité (ventes, encaissements, commandes, créances, stock).",
    defaultEnabled: true,
    externalEffect: false,
    defaultConfig: {},
    defaultSchedule: "daily@07:00",
  },
  CUSTOM: {
    type: "CUSTOM",
    name: "Règle personnalisée",
    description: "Réservé à un usage avancé. Non développé dans cette version.",
    defaultEnabled: false,
    externalEffect: false,
    defaultConfig: {},
    defaultSchedule: null,
  },
};

/** Types réellement détectés par une passe d'automatisation (CUSTOM exclu, §3). */
export const DETECTABLE_RULE_TYPES: AutomationRuleType[] = [
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "OVERDUE_DEBT",
  "PAYMENT_DUE_SOON",
  "INACTIVE_CUSTOMER",
  "SALES_OPPORTUNITY",
  "ORDER_PENDING_CONFIRMATION",
  "ORDER_STUCK",
  "ORDER_TO_PREPARE",
  "DAILY_SUMMARY",
];

/** Règles créées à l'onboarding d'une organisation (§58). */
export const DEFAULT_RULE_TYPES: AutomationRuleType[] = DETECTABLE_RULE_TYPES;

export function ruleDefaultEnabled(type: AutomationRuleType): boolean {
  return RULE_META[type].defaultEnabled;
}

/** Fusionne la config stockée avec les valeurs par défaut du type. */
export function effectiveRuleConfig(
  type: AutomationRuleType,
  stored: unknown,
): RuleConfig {
  const base = { ...RULE_META[type].defaultConfig };
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
      if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
        base[k] = v;
      }
    }
  }
  return base;
}

export function configNumber(cfg: RuleConfig, key: string, fallback: number): number {
  const v = cfg[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
