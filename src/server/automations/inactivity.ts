/**
 * Inactivité client — PUR (§12, §13, §64). Aucune prédiction ML : uniquement
 * « aucune commande livrée depuis X jours » et un signal d'opportunité simple
 * (« achetait régulièrement, plus rien depuis une période inhabituelle »).
 */

export const DEFAULT_INACTIVE_THRESHOLDS = [30, 60, 90] as const;

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/** Un client est inactif si sa dernière commande livrée date de plus de `thresholdDays`. */
export function isInactive(
  lastDeliveredAt: Date | null | undefined,
  now: Date,
  thresholdDays: number,
): boolean {
  if (!lastDeliveredAt) return false; // jamais commandé ≠ « redevenu » inactif
  return daysBetween(lastDeliveredAt, now) >= thresholdDays;
}

/** Palier d'inactivité franchi (le plus élevé), ou null. */
export function inactivityTier(
  lastDeliveredAt: Date | null | undefined,
  now: Date,
  thresholds: readonly number[] = DEFAULT_INACTIVE_THRESHOLDS,
): number | null {
  if (!lastDeliveredAt) return null;
  const d = daysBetween(lastDeliveredAt, now);
  let tier: number | null = null;
  for (const t of thresholds) if (d >= t) tier = t;
  return tier;
}

/**
 * Opportunité commerciale (MVP règles, §13) : le client a un rythme d'achat
 * régulier (`typicalIntervalDays`, calculé en amont depuis l'historique) et le
 * délai depuis la dernière commande dépasse nettement ce rythme, sans être si
 * long qu'il relève de l'inactif pur.
 */
export function isSalesOpportunity(input: {
  lastDeliveredAt: Date | null | undefined;
  typicalIntervalDays: number | null;
  orderCount: number;
  now: Date;
  /** Facteur de dépassement (1.5 = 50 % plus long que d'habitude). */
  overdueFactor?: number;
  /** Au-delà, on considère que c'est de l'inactivité pure, pas une opportunité. */
  inactiveCeilingDays?: number;
}): boolean {
  const {
    lastDeliveredAt,
    typicalIntervalDays,
    orderCount,
    now,
    overdueFactor = 1.5,
    inactiveCeilingDays = 90,
  } = input;
  if (!lastDeliveredAt || !typicalIntervalDays || typicalIntervalDays <= 0) return false;
  if (orderCount < 3) return false; // pas assez d'historique pour parler de « rythme »
  const gap = daysBetween(lastDeliveredAt, now);
  return gap >= typicalIntervalDays * overdueFactor && gap < inactiveCeilingDays;
}

/** Intervalle typique entre commandes = médiane des écarts (jours). Null si < 3 commandes. */
export function typicalIntervalDays(deliveredDates: Date[]): number | null {
  if (deliveredDates.length < 3) return null;
  const sorted = [...deliveredDates].sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1]!, sorted[i]!));
  }
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median =
    gaps.length % 2 === 0 ? (gaps[mid - 1]! + gaps[mid]!) / 2 : gaps[mid]!;
  return median > 0 ? Math.round(median) : null;
}
