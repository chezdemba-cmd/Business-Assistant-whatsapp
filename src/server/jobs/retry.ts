import { createHash } from "node:crypto";

/**
 * Politique de retry des jobs — PUR (§34, §35, §72). Backoff exponentiel borné,
 * nombre d'essais fini ; au-delà, le job passe en DEAD (pas de DLQ complexe).
 */

export const DEFAULT_MAX_ATTEMPTS = 3;

/** Délai avant le prochain essai (ms) : 1 min, 5 min, 15 min, plafonné à 1 h. */
export function nextBackoffMs(attempt: number): number {
  const steps = [60_000, 300_000, 900_000, 1_800_000, 3_600_000];
  const idx = Math.max(0, Math.min(steps.length - 1, attempt - 1));
  return steps[idx]!;
}

export function nextRunAfter(now: Date, attempt: number): Date {
  return new Date(now.getTime() + nextBackoffMs(attempt));
}

/** Doit-on retenter ? Non si on a atteint le plafond. */
export function shouldRetry(attempts: number, maxAttempts = DEFAULT_MAX_ATTEMPTS): boolean {
  return attempts < maxAttempts;
}

/** Statut résultant d'un échec : FAILED (retry possible) ou DEAD (épuisé). */
export function failureStatus(
  attempts: number,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
): "FAILED" | "DEAD" {
  return shouldRetry(attempts, maxAttempts) ? "FAILED" : "DEAD";
}

/**
 * Clé d'idempotence d'enqueue : deux `enqueue` avec le même (type, payload
 * signifiant) ne créent qu'un job tant que le premier n'est pas terminé.
 */
export function jobDedupeKey(type: string, parts: Array<string | number | null | undefined>): string {
  const raw = [type, ...parts.map((p) => (p == null ? "-" : String(p)))].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}
