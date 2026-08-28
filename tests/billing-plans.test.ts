import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FEATURES,
  LIMIT_PERIOD,
  PLAN_DEFS,
  PLAN_ORDER,
  planDef,
} from "../src/server/billing/plans.ts";

test("§15 : les 3 offres existent, ordonnées", () => {
  assert.deepEqual(PLAN_ORDER, ["STARTER", "BUSINESS", "PRO"]);
  for (const c of PLAN_ORDER) assert.equal(planDef(c).code, c);
});

test("§16 : STARTER limité, BUSINESS complet équipe, PRO illimité sur l'IA", () => {
  assert.equal(PLAN_DEFS.STARTER.features.VOICE, false);
  assert.equal(PLAN_DEFS.STARTER.features.MARKETING, false);
  assert.equal(PLAN_DEFS.BUSINESS.features.TEAM, true);
  assert.equal(PLAN_DEFS.BUSINESS.features.AUTOMATIONS, true);
  assert.equal(PLAN_DEFS.PRO.limits.AI_REQUESTS, null); // illimité
  assert.equal(PLAN_DEFS.PRO.features.LANGUAGE_ADVANCED, true);
});

test("chaque plan déclare TOUTES les features (aucune indéfinie)", () => {
  for (const c of PLAN_ORDER) {
    for (const f of FEATURES) {
      assert.equal(typeof PLAN_DEFS[c].features[f], "boolean", `${c}.${f}`);
    }
  }
});

test("chaque métrique a une période DAY|MONTH", () => {
  for (const p of Object.values(LIMIT_PERIOD)) {
    assert.ok(p === "DAY" || p === "MONTH");
  }
});

test("les features montent en gamme (STARTER ⊆ BUSINESS ⊆ PRO)", () => {
  for (const f of FEATURES) {
    if (PLAN_DEFS.STARTER.features[f]) assert.equal(PLAN_DEFS.BUSINESS.features[f], true, f);
    if (PLAN_DEFS.BUSINESS.features[f]) assert.equal(PLAN_DEFS.PRO.features[f], true, f);
  }
});
