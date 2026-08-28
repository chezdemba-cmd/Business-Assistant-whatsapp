import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectVoiceLanguage,
  normalizeVoiceText,
} from "../src/server/voice/language-detection.ts";

test("§45 français détecté", () => {
  const r = detectVoiceLanguage({ text: "Je veux six sacs de sucre" });
  assert.equal(r.language, "FR");
  assert.equal(r.mixed, false);
});

test("§46 bambara détecté et conservé", () => {
  const r = detectVoiceLanguage({ text: "Aw ni sɔgɔma, sukaro sɔngɔ ye joli ye ?" });
  assert.equal(r.language, "BM");
});

test("§47 code-switching → MIXED (aucune normalisation destructive du sens)", () => {
  const r = detectVoiceLanguage({ text: "N b'a fɛ, ajoute-moi 2 cartons de lait." });
  assert.equal(r.language, "MIXED");
  assert.equal(r.mixed, true);
});

test("indice provider utilisé quand le texte ne tranche pas", () => {
  assert.equal(detectVoiceLanguage({ text: "xxxxx", providerLanguage: "fr" }).language, "FR");
  assert.equal(detectVoiceLanguage({ text: "xxxxx", providerLanguage: "bm" }).language, "BM");
  assert.equal(detectVoiceLanguage({ text: "xxxxx", providerLanguage: "fr+bm" }).language, "MIXED");
});

test("rien d'exploitable → UNKNOWN", () => {
  assert.equal(detectVoiceLanguage({ text: "123 456" }).language, "UNKNOWN");
});

test("normalizeVoiceText : nettoyage doux, non destructif", () => {
  assert.equal(normalizeVoiceText("  je   veux  six  sacs .  "), "je veux six sacs.");
  // pas de translittération, pas de suppression de mots
  assert.equal(normalizeVoiceText("N b'a fɛ lait"), "N b'a fɛ lait");
});
