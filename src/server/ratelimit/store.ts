import "server-only";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  MemoryRateLimitStore,
  type RateLimitStore,
  type RateResult,
} from "./memory-store.ts";

/**
 * Rate limiting — sélection du store (§6). En mono-instance, `memory` suffit.
 * En multi-instance : implémenter un `RateLimitStore` Redis (INCR + PEXPIRE, ou
 * fenêtre glissante Lua) et le sélectionner via `RATE_LIMIT_STORE=redis`.
 * Tant que le client Redis n'est pas ajouté, `redis` log un avertissement et
 * retombe sur la mémoire (visible dans /api/health).
 */
export type { RateResult, RateLimitStore } from "./memory-store.ts";
export { MemoryRateLimitStore } from "./memory-store.ts";

let store: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (store) return store;
  if (getEnv().RATE_LIMIT_STORE === "redis") {
    logger.error("ratelimit.redis.notInstalled", {
      service: "ratelimit",
      event: "fallback_to_memory",
      impact: "rate-limit NON partagé entre instances — protection par instance seulement",
    });
  }
  store = new MemoryRateLimitStore();
  return store;
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateResult> {
  return getRateLimitStore().consume(key, limit, windowMs);
}

export function __resetRateLimitStore(): void {
  store = null;
}
