import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCandidateScore,
  explainScore,
} from "../src/language-core/learning/scoring.ts";

const now = new Date("2026-09-01T00:00:00Z");

test("score borné [0,1]", () => {
  const lo = calculateCandidateScore({
    occurrenceCount: 0, correctionCount: 0, organizationCount: 0, sourceCount: 0,
    lastSeenAt: new Date("2020-01-01"), now,
  });
  const hi = calculateCandidateScore({
    occurrenceCount: 999, correctionCount: 999, organizationCount: 999, sourceCount: 999,
    lastSeenAt: now, now,
  });
  assert.ok(lo >= 0 && lo <= 1);
  assert.ok(hi >= 0 && hi <= 1);
  assert.ok(hi > lo);
});

test("plus de corrections → score plus élevé (déterministe)", () => {
  const base = { occurrenceCount: 5, organizationCount: 1, sourceCount: 1, lastSeenAt: now, now };
  const a = calculateCandidateScore({ ...base, correctionCount: 1 });
  const b = calculateCandidateScore({ ...base, correctionCount: 4 });
  assert.ok(b > a);
});

test("explainScore : facteurs lisibles, somme ≈ score (non opaque, §16)", () => {
  const s = { occurrenceCount: 12, correctionCount: 8, organizationCount: 5, sourceCount: 3, lastSeenAt: now, now };
  const factors = explainScore(s);
  assert.equal(factors.length, 5);
  assert.match(factors[0]!.label, /8 correction/);
  const sum = Math.min(1, factors.reduce((a, f) => a + f.contribution, 0));
  assert.ok(Math.abs(sum - calculateCandidateScore(s)) < 0.002);
});

test("récence : dernière vue > 30 j → pas de bonus recency", () => {
  const old = calculateCandidateScore({
    occurrenceCount: 5, correctionCount: 3, organizationCount: 2, sourceCount: 2,
    lastSeenAt: new Date("2026-06-01T00:00:00Z"), now,
  });
  const fresh = calculateCandidateScore({
    occurrenceCount: 5, correctionCount: 3, organizationCount: 2, sourceCount: 2,
    lastSeenAt: now, now,
  });
  assert.ok(fresh - old >= 0.09);
});
