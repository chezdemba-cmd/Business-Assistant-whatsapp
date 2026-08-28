import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MAX_ATTEMPTS,
  failureStatus,
  jobDedupeKey,
  nextBackoffMs,
  nextRunAfter,
  shouldRetry,
} from "../src/server/jobs/retry.ts";

test("§34 : backoff croissant et borné", () => {
  const a = nextBackoffMs(1);
  const b = nextBackoffMs(2);
  const c = nextBackoffMs(3);
  assert.ok(a < b && b < c);
  assert.equal(nextBackoffMs(99), 3_600_000); // plafonné à 1 h
  assert.equal(nextBackoffMs(0), a); // borne basse
});

test("§34 : shouldRetry s'arrête au plafond", () => {
  assert.equal(shouldRetry(0), true);
  assert.equal(shouldRetry(2), true);
  assert.equal(shouldRetry(3), false);
  assert.equal(shouldRetry(3, 5), true);
});

test("§35 : failureStatus → FAILED puis DEAD une fois les essais épuisés", () => {
  assert.equal(failureStatus(1), "FAILED");
  assert.equal(failureStatus(DEFAULT_MAX_ATTEMPTS), "DEAD");
});

test("nextRunAfter place le prochain essai dans le futur", () => {
  const now = new Date("2026-08-27T00:00:00Z");
  const next = nextRunAfter(now, 1);
  assert.ok(next.getTime() > now.getTime());
});

test("§72 : jobDedupeKey est stable pour un même job logique → enqueue idempotent", () => {
  const k1 = jobDedupeKey("AUTOMATION_RUN", ["org_1", "pass"]);
  const k2 = jobDedupeKey("AUTOMATION_RUN", ["org_1", "pass"]);
  const k3 = jobDedupeKey("AUTOMATION_RUN", ["org_2", "pass"]);
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
  assert.equal(k1.length, 40);
});
