import { test } from "node:test";
import assert from "node:assert/strict";
import { secretsMatch } from "../src/lib/secret-compare.ts";

test("secrets identiques → true", () => {
  assert.equal(secretsMatch("s3cr3t-value-1234", "s3cr3t-value-1234"), true);
});

test("secrets différents (même longueur) → false", () => {
  assert.equal(secretsMatch("s3cr3t-value-1234", "s3cr3t-value-1235"), false);
});

test("secrets de longueurs différentes → false", () => {
  assert.equal(secretsMatch("court", "beaucoup-plus-long-que-lautre"), false);
});

test("valeur fournie absente / vide → false", () => {
  assert.equal(secretsMatch(null, "x"), false);
  assert.equal(secretsMatch(undefined, "x"), false);
  assert.equal(secretsMatch("", "x"), false);
});

test("valeur attendue absente → false", () => {
  assert.equal(secretsMatch("x", null), false);
  assert.equal(secretsMatch("x", ""), false);
});
