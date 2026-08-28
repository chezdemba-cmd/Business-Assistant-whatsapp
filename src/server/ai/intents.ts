/** Classification d'intention légère — PUR. Une douzaine d'intents, pas plus. */

export const AI_INTENTS = [
  "GREETING",
  "PRODUCT_SEARCH",
  "PRODUCT_PRICE",
  "PRODUCT_AVAILABILITY",
  "ORDER_REQUEST",
  "ORDER_STATUS",
  "CUSTOMER_BALANCE",
  "PAYMENT_INFO",
  "DEBT_QUERY",
  "BUSINESS_SUMMARY",
  "HUMAN_REQUEST",
  "UNKNOWN",
] as const;

export type AiIntent = (typeof AI_INTENTS)[number];

export function isAiIntent(v: unknown): v is AiIntent {
  return typeof v === "string" && (AI_INTENTS as readonly string[]).includes(v);
}

/** Intents purement consultatifs (aucune écriture possible). */
export const READ_ONLY_INTENTS: readonly AiIntent[] = [
  "GREETING",
  "PRODUCT_SEARCH",
  "PRODUCT_PRICE",
  "PRODUCT_AVAILABILITY",
  "ORDER_STATUS",
  "CUSTOMER_BALANCE",
  "PAYMENT_INFO",
  "DEBT_QUERY",
  "BUSINESS_SUMMARY",
];

export function intentIsReadOnly(intent: AiIntent): boolean {
  return READ_ONLY_INTENTS.includes(intent);
}
