import type { MessageStatus } from "@prisma/client";

/**
 * Progression des statuts d'un message SORTANT :
 *   QUEUED → SENT → DELIVERED → READ
 * `FAILED` peut survenir tant que le message n'est pas encore livré.
 * Les webhooks Meta peuvent arriver dans le désordre : on ne RÉGRESSE jamais
 * (un `SENT` reçu après un `READ` est ignoré).
 */

const OUTBOUND_RANK: Record<string, number> = {
  QUEUED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
};

export function messageStatusRank(status: MessageStatus): number {
  return OUTBOUND_RANK[status] ?? 0;
}

/**
 * Fusionne le statut courant et un statut entrant (webhook). Retourne le
 * statut à persister.
 *  - `RECEIVED` (inbound) n'est jamais modifié.
 *  - `FAILED` s'applique seulement si le message n'a pas déjà été livré/lu.
 *  - sinon on garde le rang le plus avancé.
 */
export function mergeMessageStatus(
  current: MessageStatus,
  incoming: MessageStatus,
): MessageStatus {
  if (current === "RECEIVED") return "RECEIVED";
  if (current === "FAILED") return "FAILED";

  if (incoming === "FAILED") {
    return messageStatusRank(current) >= OUTBOUND_RANK.DELIVERED!
      ? current
      : "FAILED";
  }

  return messageStatusRank(incoming) > messageStatusRank(current)
    ? incoming
    : current;
}
