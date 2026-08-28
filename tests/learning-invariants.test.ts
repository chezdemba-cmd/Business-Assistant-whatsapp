import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROMOTION_TARGET_STATUS,
  assertPromotionStatus,
  requiresFinalHumanValidation,
  LearningInvariantError,
} from "../src/language-core/learning/invariants.ts";

test("§1/§63 INVARIANT : une promotion ne vise QUE le statut SUGGESTED", () => {
  assert.equal(PROMOTION_TARGET_STATUS, "SUGGESTED");
  assert.doesNotThrow(() => assertPromotionStatus("SUGGESTED"));
});

test("§63 : promouvoir directement en VALIDATED est interdit", () => {
  assert.throws(() => assertPromotionStatus("VALIDATED"), LearningInvariantError);
  assert.throws(() => assertPromotionStatus("GLOBAL"), LearningInvariantError);
  assert.throws(() => assertPromotionStatus("OBSERVED"), LearningInvariantError);
});

test("GLOBAL / DOMAIN exigent une validation humaine finale séparée", () => {
  assert.equal(requiresFinalHumanValidation("GLOBAL"), true);
  assert.equal(requiresFinalHumanValidation("DOMAIN"), true);
  assert.equal(requiresFinalHumanValidation("ORGANIZATION"), false);
});
