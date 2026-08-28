import type { AiConfidence } from "@prisma/client";

/**
 * Politique de confiance — PUR. Le LLM propose une confiance ; c'est CE code
 * (pas le modèle) qui décide de la suite.
 *
 *   LOW    → handoff humain
 *   MEDIUM → réponse prudente / demande de précision, jamais d'action write
 *   HIGH   → réponse automatique autorisée (lecture seule) ; les actions write
 *            passent TOUJOURS par une proposition + confirmation humaine.
 */

export type AiPolicyDecision = {
  /** Envoyer une réponse automatique au client. */
  autoReply: boolean;
  /** Basculer la conversation en HUMAN. */
  handoff: boolean;
  /** Autoriser la préparation d'un brouillon de commande. */
  allowDraft: boolean;
  reason: string;
};

export function normalizeConfidence(v: unknown): AiConfidence {
  if (v === "HIGH" || v === "MEDIUM" || v === "LOW") return v;
  if (typeof v === "number") {
    if (v >= 0.75) return "HIGH";
    if (v >= 0.45) return "MEDIUM";
    return "LOW";
  }
  return "LOW";
}

export function decidePolicy(input: {
  confidence: AiConfidence;
  intent: string;
  /** L'IA a explicitement demandé un humain. */
  explicitHandoff: boolean;
  /** Message client de type audio / non-texte. */
  nonTextInbound: boolean;
  /** Fenêtre de service WhatsApp 24 h ouverte. */
  serviceWindowOpen: boolean;
}): AiPolicyDecision {
  if (input.explicitHandoff || input.intent === "HUMAN_REQUEST") {
    return { autoReply: false, handoff: true, allowDraft: false, reason: "Le client ou l'IA demande un humain." };
  }
  if (input.nonTextInbound) {
    return { autoReply: false, handoff: true, allowDraft: false, reason: "Message non textuel (audio/média) — traitement humain." };
  }
  if (!input.serviceWindowOpen) {
    return { autoReply: false, handoff: true, allowDraft: false, reason: "Fenêtre WhatsApp 24 h fermée — modèle approuvé requis." };
  }
  if (input.confidence === "LOW") {
    return { autoReply: false, handoff: true, allowDraft: false, reason: "Confiance insuffisante." };
  }
  if (input.confidence === "MEDIUM") {
    return { autoReply: true, handoff: false, allowDraft: false, reason: "Réponse prudente / demande de précision." };
  }
  return { autoReply: true, handoff: false, allowDraft: true, reason: "Confiance élevée — réponse automatique (lecture seule)." };
}
