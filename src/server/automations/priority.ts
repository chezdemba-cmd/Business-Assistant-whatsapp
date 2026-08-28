/**
 * Priorité d'une recommandation — PUR, déterministe, sans score opaque (§6, §54).
 * On combine des seuils métier simples ; aucune pondération « pseudo-scientifique ».
 */

export type RecommendationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const RANK: Record<RecommendationPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export function maxPriority(
  a: RecommendationPriority,
  b: RecommendationPriority,
): RecommendationPriority {
  return RANK[a] >= RANK[b] ? a : b;
}

export function priorityRank(p: RecommendationPriority): number {
  return RANK[p];
}

/** Stock : faible → MEDIUM, rupture → HIGH (§8, §9). */
export function stockPriority(available: number): RecommendationPriority {
  return available <= 0 ? "HIGH" : "MEDIUM";
}

/**
 * Créance en retard : la priorité monte avec l'ancienneté ET le montant.
 * 90+ jours OU montant très élevé → HIGH ; au-delà, CRITICAL (§6, §10).
 */
export function overdueDebtPriority(
  daysOverdue: number,
  amount: number,
  opts: { largeAmount?: number; hugeAmount?: number } = {},
): RecommendationPriority {
  const large = opts.largeAmount ?? 100_000;
  const huge = opts.hugeAmount ?? 500_000;
  if (daysOverdue >= 90 && amount >= huge) return "CRITICAL";
  if (daysOverdue >= 90 || amount >= huge) return "HIGH";
  if (daysOverdue >= 60 || amount >= large) return "HIGH";
  if (daysOverdue >= 30) return "MEDIUM";
  return "LOW";
}

/** Paiement bientôt dû : information → LOW, sauf gros montant → MEDIUM (§11). */
export function paymentDueSoonPriority(
  amount: number,
  opts: { largeAmount?: number } = {},
): RecommendationPriority {
  return amount >= (opts.largeAmount ?? 100_000) ? "MEDIUM" : "LOW";
}

/** Client inactif : plus l'inactivité est longue, plus c'est prioritaire (§12). */
export function inactiveCustomerPriority(daysInactive: number): RecommendationPriority {
  if (daysInactive >= 120) return "HIGH";
  if (daysInactive >= 90) return "MEDIUM";
  return "LOW";
}

/** Commande en attente de confirmation trop longtemps → MEDIUM, très longtemps → HIGH (§14). */
export function orderPendingPriority(hoursWaiting: number): RecommendationPriority {
  return hoursWaiting >= 24 ? "HIGH" : "MEDIUM";
}

/** Commande bloquée en préparation / livraison → HIGH (§15). */
export function orderStuckPriority(hoursStuck: number): RecommendationPriority {
  return hoursStuck >= 96 ? "CRITICAL" : "HIGH";
}
