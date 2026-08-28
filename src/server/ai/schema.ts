import { z } from "zod";
import { AI_INTENTS } from "./intents.ts";

/**
 * Sortie STRUCTURÉE et VALIDÉE du modèle (jamais de JSON libre non contrôlé).
 * Le modèle ne peut demander que des `toolName` de la liste blanche ; il ne
 * fournit jamais d'organizationId (injecté serveur).
 */

export const AI_TOOL_NAMES = [
  "searchProducts",
  "getProductAvailability",
  "getCustomerByPhone",
  "searchCustomers",
  "getCustomerFinancialSummary",
  "listCustomerOrders",
  "getOrderDetails",
  "getDebtsOverview",
  "getBusinessDailySummary",
] as const;

export type AiToolName = (typeof AI_TOOL_NAMES)[number];

export const aiToolRequestSchema = z.object({
  tool: z.enum(AI_TOOL_NAMES),
  args: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export const aiOrderDraftLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(100_000),
});

export const aiTurnPlanSchema = z.object({
  intent: z.enum(AI_INTENTS),
  confidence: z.union([z.enum(["LOW", "MEDIUM", "HIGH"]), z.number().min(0).max(1)]),
  language: z.enum(["FR", "BM", "AUTO"]).default("AUTO"),
  /** Réponse à adresser au client / à l'utilisateur (peut être vide si tools d'abord). */
  reply: z.string().max(2000).default(""),
  toolRequests: z.array(aiToolRequestSchema).max(4).default([]),
  /** Le modèle pense qu'un humain doit reprendre. */
  handoff: z.boolean().default(false),
  handoffReason: z.string().max(300).optional(),
  /** Brouillon de commande proposé (jamais exécuté sans confirmations). */
  orderDraft: z
    .object({
      customerConfirmed: z.boolean().default(false),
      lines: z.array(aiOrderDraftLineSchema).min(1).max(20),
      notes: z.string().max(500).optional(),
    })
    .optional(),
});

export type AiTurnPlan = z.infer<typeof aiTurnPlanSchema>;
export type AiToolRequest = z.infer<typeof aiToolRequestSchema>;

/** Parse tolérant : renvoie un plan minimal « handoff » si la sortie est cassée. */
export function safeParseTurnPlan(raw: unknown): AiTurnPlan {
  const parsed = aiTurnPlanSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return {
    intent: "UNKNOWN",
    confidence: "LOW",
    language: "AUTO",
    reply: "",
    toolRequests: [],
    handoff: true,
    handoffReason: "Sortie du modèle invalide.",
  };
}
