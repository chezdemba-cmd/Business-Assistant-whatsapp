import { randomUUID } from "node:crypto";
import type { AiGenerateResult, AiMessage, AiProvider } from "./provider-types.ts";

/**
 * Provider LLM DÉTERMINISTE pour le développement et les tests — AUCUN appel
 * réseau, aucune clé API. Produit un plan structuré cohérent à partir de
 * mots-clés. Il ne « comprend » pas : il permet de tester le pipeline, les
 * outils, l'idempotence et les gardes.
 *
 * Fichier volontairement sans `server-only` ni import d'env → testable via node:test.
 */

const KNOWN_PRODUCT_TERMS = [
  "sucre",
  "riz",
  "huile",
  "lait",
  "savon",
  "sac",
  "carton",
  "bidon",
];

function lastUser(messages: AiMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return messages[i]!.content;
  }
  return "";
}

function toolResultsBlock(messages: AiMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const c = messages[i]!.content;
    if (c.startsWith("[RESULTATS OUTILS]")) {
      return c.slice("[RESULTATS OUTILS]".length).trim();
    }
  }
  return null;
}

function fmt(n: unknown): string {
  const v = typeof n === "number" ? n : 0;
  return String(Math.trunc(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function extractQuantity(text: string): number | null {
  const m = text.match(/(\d{1,5})\s*(sacs?|cartons?|bidons?|unités?|pcs?|pièces?)?/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function plainReply(reply: string, intent: string, confidence: string) {
  return {
    intent,
    confidence,
    language: "FR",
    reply,
    toolRequests: [],
    handoff: confidence === "LOW",
  };
}

export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly model = "mock-1";

  async generateStructured(input: {
    system: string;
    messages: AiMessage[];
  }): Promise<AiGenerateResult> {
    const text = lastUser(input.messages).toLowerCase().trim();
    const results = toolResultsBlock(input.messages);
    const raw = results ? finalize(text, results) : firstPass(text);
    return { raw, inputTokens: 0, outputTokens: 0 };
  }
}

function firstPass(text: string): unknown {
  if (
    /ignore|oublie tes r[eè]gles|tous les clients|toutes les dettes|all customers|system prompt/i.test(
      text,
    )
  ) {
    return {
      intent: "UNKNOWN",
      confidence: "MEDIUM",
      language: "FR",
      reply:
        "Je ne peux partager que les informations de votre compte. Souhaitez-vous parler à un membre de l'équipe ?",
      toolRequests: [],
      handoff: false,
    };
  }
  if (/parler.*(humain|conseiller|quelqu'un)|un humain|agent r[eé]el/i.test(text)) {
    return {
      intent: "HUMAN_REQUEST",
      confidence: "HIGH",
      language: "FR",
      reply: "",
      toolRequests: [],
      handoff: true,
      handoffReason: "Le client demande un humain.",
    };
  }
  const qty = extractQuantity(text);
  const term = KNOWN_PRODUCT_TERMS.find((t) => text.includes(t));

  const greetingOnly =
    text.length < 4 ||
    /^(bonjour|salut|slt|aw ni|coucou|hello|bonsoir)\b[\s!,.?]*$/i.test(text);
  if (greetingOnly && !term && !qty) {
    return {
      intent: "GREETING",
      confidence: "HIGH",
      language: text.includes("aw ni") ? "BM" : "FR",
      reply: "Bonjour ! Comment puis-je vous aider ?",
      toolRequests: [],
      handoff: false,
    };
  }

  if (/(doit|dette|cr[ée]ance|impay[ée]|solde|combien.*dois)/i.test(text)) {
    const nameMatch = text.match(
      /(?:combien|solde de|dette de)\s+([a-zàâäéèêëïîôöùûüç' -]{2,40})/i,
    );
    if (nameMatch) {
      return {
        intent: "CUSTOMER_BALANCE",
        confidence: "HIGH",
        language: "FR",
        reply: "",
        toolRequests: [
          { tool: "searchCustomers", args: { query: nameMatch[1]!.trim() } },
        ],
        handoff: false,
      };
    }
    return {
      intent: "DEBT_QUERY",
      confidence: "HIGH",
      language: "FR",
      reply: "",
      toolRequests: [{ tool: "getDebtsOverview", args: {} }],
      handoff: false,
    };
  }

  if (/(vendu|ventes|encaiss|chiffre|r[ée]sum[ée]|aujourd)/i.test(text)) {
    return {
      intent: "BUSINESS_SUMMARY",
      confidence: "HIGH",
      language: "FR",
      reply: "",
      toolRequests: [{ tool: "getBusinessDailySummary", args: {} }],
      handoff: false,
    };
  }

  if (term) {
    const intent = qty
      ? "ORDER_REQUEST"
      : /prix|co[uû]te|combien/i.test(text)
        ? "PRODUCT_PRICE"
        : "PRODUCT_AVAILABILITY";
    return {
      intent,
      confidence: "HIGH",
      language: "FR",
      reply: "",
      toolRequests: [{ tool: "searchProducts", args: { query: term } }],
      handoff: false,
    };
  }

  return {
    intent: "UNKNOWN",
    confidence: "LOW",
    language: "FR",
    reply: "",
    toolRequests: [],
    handoff: true,
    handoffReason: "Demande non comprise.",
  };
}

function finalize(text: string, resultsJson: string): unknown {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(resultsJson) as Record<string, unknown>;
  } catch {
    /* ignore */
  }

  const debts = data.getDebtsOverview as
    | { totalOutstanding?: number; overdueOutstanding?: number; debtorCount?: number; currencyLabel?: string }
    | undefined;
  if (debts && !("error" in debts)) {
    return {
      intent: "DEBT_QUERY",
      confidence: "HIGH",
      language: "FR",
      reply: `Créances en cours : ${fmt(debts.totalOutstanding)} ${debts.currencyLabel ?? ""} sur ${debts.debtorCount ?? 0} client(s), dont ${fmt(debts.overdueOutstanding)} en retard.`,
      toolRequests: [],
      handoff: false,
    };
  }

  const summary = data.getBusinessDailySummary as
    | { salesToday?: number; cashCollectedToday?: number; ordersToday?: number; currencyLabel?: string }
    | undefined;
  if (summary && !("error" in summary)) {
    return {
      intent: "BUSINESS_SUMMARY",
      confidence: "HIGH",
      language: "FR",
      reply: `Aujourd'hui : ${fmt(summary.salesToday)} ${summary.currencyLabel ?? ""} de ventes livrées, ${fmt(summary.cashCollectedToday)} ${summary.currencyLabel ?? ""} encaissés, ${summary.ordersToday ?? 0} commande(s) créée(s).`,
      toolRequests: [],
      handoff: false,
    };
  }

  const customers = data.searchCustomers as
    | { matches?: Array<{ id: string; displayName: string }> }
    | undefined;
  if (customers) {
    const m = customers.matches ?? [];
    if (m.length === 0) return plainReply("Je ne trouve pas ce client.", "CUSTOMER_BALANCE", "MEDIUM");
    if (m.length > 1) {
      return plainReply(
        `Plusieurs clients correspondent : ${m.map((c) => c.displayName).join(", ")}. Lequel ?`,
        "CUSTOMER_BALANCE",
        "MEDIUM",
      );
    }
    return {
      intent: "CUSTOMER_BALANCE",
      confidence: "HIGH",
      language: "FR",
      reply: "",
      toolRequests: [
        { tool: "getCustomerFinancialSummary", args: { customerId: m[0]!.id } },
      ],
      handoff: false,
    };
  }

  const fin = data.getCustomerFinancialSummary as
    | { customerName?: string; totalOutstanding?: number; overdueOutstanding?: number; currencyLabel?: string }
    | undefined;
  if (fin && !("error" in fin)) {
    return plainReply(
      `${fin.customerName ?? "Ce client"} doit ${fmt(fin.totalOutstanding)} ${fin.currencyLabel ?? ""}${
        fin.overdueOutstanding ? ` (dont ${fmt(fin.overdueOutstanding)} en retard)` : ""
      }.`,
      "CUSTOMER_BALANCE",
      "HIGH",
    );
  }

  const products = data.searchProducts as
    | { matches?: Array<{ id: string; name: string; salePrice: number; available: number; currencyLabel?: string }> }
    | undefined;
  if (products) {
    const m = products.matches ?? [];
    if (m.length === 0) {
      return plainReply(
        "Je ne trouve pas ce produit dans le catalogue. Je peux transmettre votre demande à l'équipe.",
        "PRODUCT_SEARCH",
        "MEDIUM",
      );
    }
    if (m.length > 1) {
      return plainReply(
        `Nous avons : ${m.map((p) => p.name).join(", ")}. Lequel vous intéresse ?`,
        "PRODUCT_SEARCH",
        "MEDIUM",
      );
    }
    const p = m[0]!;
    const qty = extractQuantity(text);
    if (qty && qty > 0) {
      if (qty > p.available) {
        return plainReply(
          `Il ne reste que ${p.available} en stock pour « ${p.name} », je ne peux pas préparer ${qty}.`,
          "ORDER_REQUEST",
          "MEDIUM",
        );
      }
      return {
        intent: "ORDER_REQUEST",
        confidence: "HIGH",
        language: "FR",
        reply: `J'ai préparé : ${qty} × ${p.name} à ${fmt(p.salePrice)} ${p.currencyLabel ?? ""}/unité. Total : ${fmt(p.salePrice * qty)} ${p.currencyLabel ?? ""}. Souhaitez-vous confirmer ?`,
        toolRequests: [],
        handoff: false,
        orderDraft: { customerConfirmed: false, lines: [{ productId: p.id, quantity: qty }] },
      };
    }
    return plainReply(
      `Oui, il reste ${p.available} unité(s) de ${p.name}, à ${fmt(p.salePrice)} ${p.currencyLabel ?? ""}. Combien en souhaitez-vous ?`,
      "PRODUCT_AVAILABILITY",
      "HIGH",
    );
  }

  return plainReply("Un membre de l'équipe va reprendre votre demande.", "UNKNOWN", "LOW");
}

/** Utilitaire de test — identifiant factice de message sortant. */
export function mockOutboundId(): string {
  return `mock-${randomUUID()}`;
}
