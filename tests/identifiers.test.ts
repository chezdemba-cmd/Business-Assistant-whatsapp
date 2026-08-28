import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  toE164OrNull,
  isValidPhone,
  isValidE164,
  slugify,
} from "../src/lib/identifiers.ts";

// Numéros nationaux valides par pays -> E.164 attendu.
const CASES: Array<[country: string, national: string, e164: string]> = [
  ["ML", "76 01 02 03", "+22376010203"], // Mali
  ["CI", "07 87 65 43 21", "+2250787654321"], // Côte d'Ivoire (10 chiffres)
  ["SN", "77 123 45 67", "+221771234567"], // Sénégal
  ["BF", "70 12 34 56", "+22670123456"], // Burkina Faso
  ["GN", "621 23 45 67", "+224621234567"], // Guinée
  ["FR", "06 12 34 56 78", "+33612345678"], // France
];

for (const [country, national, e164] of CASES) {
  test(`normalizePhone — ${country} format national -> E.164`, () => {
    assert.equal(normalizePhone(national, country), e164);
    assert.equal(toE164OrNull(national, country), e164);
    assert.equal(isValidPhone(national, country), true);
  });

  test(`normalizePhone — ${country} format international -> E.164 (indépendant du pays par défaut)`, () => {
    assert.equal(normalizePhone(e164, "ML"), e164);
    assert.equal(toE164OrNull(e164, "ZZ"), e164);
  });
}

test("toE164OrNull renvoie null sur un numéro invalide", () => {
  assert.equal(toE164OrNull("abc", "ML"), null);
  assert.equal(toE164OrNull("123", "ML"), null);
  assert.equal(toE164OrNull("", "ML"), null);
  assert.equal(isValidPhone("pas un numéro", "ML"), false);
});

test("normalizePhone ne jette jamais et produit un E.164 plausible en repli", () => {
  assert.equal(normalizePhone("00225 07 87 65 43 21"), "+2250787654321");
  assert.match(normalizePhone("999", "ML"), /^\+\d+$/);
});

test("isValidE164 (forme brute)", () => {
  assert.equal(isValidE164("+22376010203"), true);
  assert.equal(isValidE164("76010203"), false);
  assert.equal(isValidE164("+0123"), false);
});

test("slugify — minuscule, sans accent, sans espace", () => {
  assert.equal(slugify("Bamako Distribution"), "bamako-distribution");
  assert.equal(slugify("Société Générale de Négoce"), "societe-generale-de-negoce");
  assert.equal(slugify("   "), "entreprise");
  assert.equal(slugify("A&B  ---  C"), "a-b-c");
});
