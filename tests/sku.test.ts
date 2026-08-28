import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSku, isValidSku } from "../src/server/stock/sku.ts";

test("normalizeSku — trim, majuscules, séparateurs unifiés", () => {
  assert.equal(normalizeSku("  suc-050 "), "SUC-050");
  assert.equal(normalizeSku("suc 050"), "SUC-050");
  assert.equal(normalizeSku("riz//25"), "RIZ-25");
  assert.equal(normalizeSku("hui_020"), "HUI-020");
  assert.equal(normalizeSku("--abc--"), "ABC");
  assert.equal(normalizeSku("a  b   c"), "A-B-C");
});

test("isValidSku", () => {
  assert.equal(isValidSku("SUC-050"), true);
  assert.equal(isValidSku("RIZ.25"), true);
  assert.equal(isValidSku("A1"), true);
  assert.equal(isValidSku(""), false);
  assert.equal(isValidSku("-ABC"), false);
  assert.equal(isValidSku("ABC$"), false);
});

test("normalizeSku puis isValidSku : idempotent et cohérent", () => {
  for (const raw of ["suc-050", " riz 25 ", "Hui/020", "LAI_025"]) {
    const n = normalizeSku(raw);
    assert.equal(normalizeSku(n), n);
    assert.equal(isValidSku(n), true, raw);
  }
});
