import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryRateLimitStore } from "../src/server/ratelimit/memory-store.ts";

test("§6 : consomme des jetons puis refuse au-delà de la limite", async () => {
  const store = new MemoryRateLimitStore();
  const now = Date.now();
  const r1 = await store.consume("k", 3, 60_000, now);
  const r2 = await store.consume("k", 3, 60_000, now);
  const r3 = await store.consume("k", 3, 60_000, now);
  const r4 = await store.consume("k", 3, 60_000, now);
  assert.deepEqual([r1.allowed, r2.allowed, r3.allowed, r4.allowed], [true, true, true, false]);
  assert.equal(r4.remaining, 0);
});

test("la fenêtre se réinitialise après expiration", async () => {
  const store = new MemoryRateLimitStore();
  const now = Date.now();
  await store.consume("k", 1, 1000, now);
  const blocked = await store.consume("k", 1, 1000, now + 500);
  assert.equal(blocked.allowed, false);
  const fresh = await store.consume("k", 1, 1000, now + 1500);
  assert.equal(fresh.allowed, true);
});

test("les clés sont indépendantes ; reset vide une clé", async () => {
  const store = new MemoryRateLimitStore();
  const now = Date.now();
  await store.consume("a", 1, 1000, now);
  const b = await store.consume("b", 1, 1000, now);
  assert.equal(b.allowed, true);
  await store.reset("a");
  const aAgain = await store.consume("a", 1, 1000, now);
  assert.equal(aAgain.allowed, true);
});
