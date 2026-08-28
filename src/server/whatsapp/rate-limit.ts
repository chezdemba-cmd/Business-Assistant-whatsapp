/**
 * Limiteur de débit en mémoire — « best effort », par instance de serveur.
 * Suffisant pour amortir un flood accidentel sur le webhook. Pour un vrai
 * multi-instance, remplacer par un store partagé (Redis) — cf. dette technique.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): { allowed: boolean; remaining: number; resetAt: number } {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Test/maintenance : vide l'état. */
export function __resetRateLimit(): void {
  buckets.clear();
}
