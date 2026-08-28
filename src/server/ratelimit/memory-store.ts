/**
 * Store de rate-limit en mémoire — PUR (§6). Fenêtre fixe par clé. Suffisant en
 * mono-instance ; en multi-instance, fournir un `RateLimitStore` adossé à Redis.
 */

export type RateResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export interface RateLimitStore {
  readonly kind: "memory" | "redis";
  consume(key: string, limit: number, windowMs: number, now?: number): Promise<RateResult>;
  reset(key: string): Promise<void>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  readonly kind = "memory" as const;
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async consume(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateResult> {
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetAt };
    }
    b.count += 1;
    return {
      allowed: b.count <= limit,
      remaining: Math.max(0, limit - b.count),
      resetAt: b.resetAt,
    };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}
