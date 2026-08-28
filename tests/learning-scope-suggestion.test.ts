import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestScope } from "../src/language-core/learning/scope-suggestion.ts";
import { DEFAULT_THRESHOLDS } from "../src/language-core/learning/config.ts";

const T = DEFAULT_THRESHOLDS;
const base = {
  occurrenceCount: 20,
  correctionCount: 10,
  confidenceScore: 0.8,
  shareable: true,
  thresholds: T,
};

test("§51 : 1 seule organisation → ORGANIZATION (jamais DOMAIN/GLOBAL)", () => {
  const r = suggestScope({ ...base, organizationCount: 1, domainCount: 1 });
  assert.equal(r.scope, "ORGANIZATION");
});

test("§52 : plusieurs organisations, 1 domaine, seuils atteints → DOMAIN", () => {
  const r = suggestScope({ ...base, organizationCount: 5, domainCount: 1 });
  assert.equal(r.scope, "DOMAIN");
  assert.equal(r.requiresStrongReview, true);
});

test("§53 : non anonymisable → ORGANIZATION même avec 100 occurrences", () => {
  const r = suggestScope({
    ...base,
    organizationCount: 50,
    domainCount: 3,
    occurrenceCount: 100,
    correctionCount: 100,
    shareable: false,
  });
  assert.equal(r.scope, "ORGANIZATION");
});

test("GLOBAL exige multi-domaines + forte diversité (et jamais automatique)", () => {
  const notGlobal = suggestScope({ ...base, organizationCount: 5, domainCount: 1 });
  assert.notEqual(notGlobal.scope, "GLOBAL");

  const global = suggestScope({
    ...base,
    organizationCount: T.minOrganizations * 2,
    domainCount: 2,
    occurrenceCount: T.minOccurrences * 3,
  });
  assert.equal(global.scope, "GLOBAL");
  assert.equal(global.requiresStrongReview, true);
});

test("diversité insuffisante → reste ORGANIZATION", () => {
  const r = suggestScope({ ...base, organizationCount: 2, domainCount: 1, correctionCount: 1 });
  assert.equal(r.scope, "ORGANIZATION");
});
