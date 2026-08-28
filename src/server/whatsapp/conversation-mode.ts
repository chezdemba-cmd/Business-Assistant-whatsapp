import type { ConversationMode, ConversationStatus } from "@prisma/client";

/**
 * Modes de conversation (maquette) :
 *   AUTO   → futur pilotage par Djeli IA (Phase 6). NE répond PAS tout seul ici.
 *   HUMAN  → réponses humaines depuis l'application.
 *   PAUSED → aucune automatisation.
 */

export const CONVERSATION_MODE_LABEL: Record<ConversationMode, string> = {
  AUTO: "AUTO",
  HUMAN: "HUMAIN",
  PAUSED: "EN PAUSE",
};

export const CONVERSATION_MODES: readonly ConversationMode[] = [
  "AUTO",
  "HUMAN",
  "PAUSED",
];

export const CONVERSATION_STATUS_LABEL: Record<ConversationStatus, string> = {
  OPEN: "Ouverte",
  CLOSED: "Fermée",
  ARCHIVED: "Archivée",
};

export const CONVERSATION_STATUSES: readonly ConversationStatus[] = [
  "OPEN",
  "CLOSED",
  "ARCHIVED",
];

/**
 * Quand un humain répond dans une conversation en AUTO, on bascule
 * automatiquement en HUMAN : cela empêchera l'IA (Phase 6) de continuer à
 * répondre pendant qu'un humain a pris la main.
 */
export function nextModeOnHumanReply(
  current: ConversationMode,
): ConversationMode {
  return current === "AUTO" ? "HUMAN" : current;
}
