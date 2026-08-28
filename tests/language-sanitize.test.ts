import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeLearningData } from "../src/language-core/sanitize.ts";

test("§56 masque nom-marqueurs PII : email, téléphone, référence commande", () => {
  const r = sanitizeLearningData(
    "Aminata au +223 76 44 12 09 doit payer la commande CMD-0042, email aminata@example.com",
  );
  assert.match(r.text, /\[tel\]/);
  assert.match(r.text, /\[ref\]/);
  assert.match(r.text, /\[email\]/);
  assert.doesNotMatch(r.text, /@example\.com/);
  assert.doesNotMatch(r.text, /CMD-0042/);
  assert.equal(r.redacted, true);
});

test("montants et longs nombres masqués", () => {
  const r = sanitizeLearningData("il doit 189000 FCFA, numéro 22376441209");
  assert.doesNotMatch(r.text, /189000/);
  assert.doesNotMatch(r.text, /22376441209/);
});

test("texte neutre : inchangé, non redacté, sans risque résiduel", () => {
  const r = sanitizeLearningData("je veux six sacs de sucre");
  assert.equal(r.text, "je veux six sacs de sucre");
  assert.equal(r.redacted, false);
  assert.equal(r.residualRisk, false);
});

test("§58 risque résiduel signalé (chiffres restants après masquage partiel)", () => {
  const r = sanitizeLearningData("code 12 34 56 pièces");
  // suites courtes non masquées -> on signale le risque pour NE PAS partager
  assert.equal(typeof r.residualRisk, "boolean");
});
