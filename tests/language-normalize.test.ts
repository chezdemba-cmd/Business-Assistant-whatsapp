import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeText, sameNormalized } from "../src/language-core/normalize.ts";

test("casse, espaces, apostrophes, ponctuation de bord", () => {
  assert.equal(normalizeText("  Bonjour, Vous avez du sucre ?  "), "bonjour, vous avez du sucre");
  assert.equal(normalizeText("N B’A FƐ"), "n b'a fɛ");
  assert.equal(normalizeText("«  sac  de   sucre  »"), "sac de sucre");
});

test("LES DIACRITIQUES BAMBARA SONT CONSERVÉS (jamais détruits)", () => {
  assert.equal(normalizeText("Sukárɔ sɔ̀ngɔ"), "sukárɔ sɔ̀ngɔ");
  assert.equal(normalizeText("ɲɛ ŋɔ ɔ ɛ"), "ɲɛ ŋɔ ɔ ɛ");
  assert.equal(normalizeText("Café crème"), "café crème");
});

test("ponctuation interne conservée, texte vide géré", () => {
  assert.equal(normalizeText("2,5 kg"), "2,5 kg");
  assert.equal(normalizeText("   "), "");
  assert.equal(normalizeText("!!!"), "");
});

test("sameNormalized", () => {
  assert.equal(sameNormalized("Sac de Sucre", "  sac de sucre. "), true);
  assert.equal(sameNormalized("sucre", "sel"), false);
  assert.equal(sameNormalized("", "  "), false);
});
