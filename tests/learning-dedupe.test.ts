import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidateDedupeKey,
  organizationHash,
} from "../src/language-core/learning/dedupe.ts";

const b = {
  normalizedText: "six sacs de sucre",
  language: "FR" as const,
  candidateType: "VARIANT" as const,
  domainCode: "commerce",
  scopeSuggestion: "DOMAIN" as const,
  organizationId: null,
};

test("§18/§54 : clé stable pour les mêmes entrées", () => {
  assert.equal(candidateDedupeKey(b), candidateDedupeKey({ ...b }));
});

test("clés distinctes selon type / scope / domaine / langue", () => {
  assert.notEqual(candidateDedupeKey(b), candidateDedupeKey({ ...b, candidateType: "NEW_ENTRY" }));
  assert.notEqual(candidateDedupeKey(b), candidateDedupeKey({ ...b, language: "BM" }));
  assert.notEqual(candidateDedupeKey(b), candidateDedupeKey({ ...b, domainCode: "health" }));
  assert.notEqual(candidateDedupeKey(b), candidateDedupeKey({ ...b, scopeSuggestion: "GLOBAL" }));
});

test("scope GLOBAL/DOMAIN : l'organizationId n'entre pas dans la clé", () => {
  const g = { ...b, scopeSuggestion: "GLOBAL" as const, domainCode: null };
  assert.equal(
    candidateDedupeKey({ ...g, organizationId: "org-A" }),
    candidateDedupeKey({ ...g, organizationId: "org-B" }),
  );
});

test("scope ORGANIZATION : l'organizationId différencie la clé", () => {
  const o = { ...b, scopeSuggestion: "ORGANIZATION" as const, domainCode: null };
  assert.notEqual(
    candidateDedupeKey({ ...o, organizationId: "org-A" }),
    candidateDedupeKey({ ...o, organizationId: "org-B" }),
  );
});

test("organizationHash : déterministe et JAMAIS l'id en clair (§17)", () => {
  assert.equal(organizationHash("org-123"), organizationHash("org-123"));
  assert.notEqual(organizationHash("org-123"), organizationHash("org-456"));
  assert.doesNotMatch(organizationHash("org-123")!, /org-123/);
  assert.equal(organizationHash(null), null);
});
