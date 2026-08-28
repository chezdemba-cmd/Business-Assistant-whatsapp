import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkAgainstLimit,
  limitPeriod,
  limitReachedMessage,
  resolveLimit,
} from "../src/server/billing/limits.ts";

const business = { planCode: "BUSINESS" as const, status: "ACTIVE" as const };

test("§21 : resolveLimit — plan, override, illimité, suspendu", () => {
  assert.equal(resolveLimit(business, "AI_REQUESTS"), 400);
  assert.equal(resolveLimit({ ...business, limitOverrides: { AI_REQUESTS: 10 } }, "AI_REQUESTS"), 10);
  assert.equal(resolveLimit({ ...business, limitOverrides: { AI_REQUESTS: null } }, "AI_REQUESTS"), null);
  assert.equal(resolveLimit({ planCode: "PRO", status: "SUSPENDED" }, "AI_REQUESTS"), 0);
  assert.equal(resolveLimit(null, "AI_REQUESTS"), 0);
});

test("§13/§21 : checkAgainstLimit — sous la limite passe, au-delà refuse SANS dépense", () => {
  const ok = checkAgainstLimit(business, "AI_REQUESTS", 399, 1);
  assert.equal(ok.allowed, true);
  assert.equal(ok.remaining, 1);

  const exact = checkAgainstLimit(business, "AI_REQUESTS", 400, 1);
  assert.equal(exact.allowed, false);
  assert.equal(exact.reason, "OVER_LIMIT");

  const batch = checkAgainstLimit(business, "MARKETING_SENDS", 4990, 20);
  assert.equal(batch.allowed, false); // 4990 + 20 > 5000
});

test("illimité (PRO) → toujours autorisé", () => {
  const r = checkAgainstLimit({ planCode: "PRO", status: "ACTIVE" }, "AI_TOKENS", 999_999_999, 100_000);
  assert.equal(r.allowed, true);
  assert.equal(r.limit, null);
});

test("période et message", () => {
  assert.equal(limitPeriod("AI_REQUESTS"), "DAY");
  assert.equal(limitPeriod("VOICE_SECONDS"), "MONTH");
  const msg = limitReachedMessage(checkAgainstLimit(business, "AI_REQUESTS", 400, 1));
  assert.match(msg, /quota/i);
});
