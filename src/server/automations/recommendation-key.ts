import { createHash } from "node:crypto";

/**
 * Clés de déduplication + refroidissement des recommandations — PUR (testable
 * sans DB). Une passe d'automatisation relancée 15 fois ne doit produire qu'UNE
 * recommandation active pour un même problème (§36). Le cooldown évite de
 * recréer la même alerte toutes les 5 minutes (§37).
 */

export type RecommendationKeyInput = {
  organizationId: string;
  type: string;
  /** Entité concernée (produit, commande, client…) ou null pour une reco globale. */
  entityId?: string | null;
  /** Fenêtre temporelle : jour métier pour DAILY_SUMMARY, sinon souvent absent. */
  periodKey?: string | null;
};

/**
 * Clé stable et lisible. Deux problèmes identiques sur la même période → même
 * clé → un seul `BusinessRecommendation` grâce à `@@unique([organizationId, dedupeKey])`.
 */
export function recommendationDedupeKey(input: RecommendationKeyInput): string {
  return [
    input.type,
    input.entityId ?? "-",
    input.periodKey ?? "-",
  ].join("|");
}

/** Variante hachée courte quand la clé lisible risque d'être trop longue. */
export function hashedDedupeKey(input: RecommendationKeyInput): string {
  const raw = `${input.organizationId}|${recommendationDedupeKey(input)}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}

/** Clé de période = jour métier `YYYY-MM-DD` dans le fuseau de l'organisation. */
export function dayPeriodKey(date: Date, timeZone: string): string {
  let tz = timeZone;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  } catch {
    tz = "UTC";
  }
  // en-CA → "YYYY-MM-DD"
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Instant de fin de refroidissement (null si `hours` ≤ 0). */
export function cooldownUntil(now: Date, hours: number): Date | null {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return new Date(now.getTime() + hours * 3_600_000);
}

/**
 * Le détecteur doit-il (re)créer la recommandation ? Non si une recommandation
 * active existe encore dans sa fenêtre de refroidissement.
 */
export function isInCooldown(
  existing: { status: string; cooldownUntil: Date | null } | null | undefined,
  now: Date,
): boolean {
  if (!existing) return false;
  if (existing.status === "DISMISSED" || existing.status === "EXPIRED") return false;
  return existing.cooldownUntil != null && existing.cooldownUntil.getTime() > now.getTime();
}
