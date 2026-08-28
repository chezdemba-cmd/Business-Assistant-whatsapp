import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasFeature,
  planHasFeature,
  featureUnavailableMessage,
} from "../src/server/billing/features.ts";

test("§20 : hasFeature suit la matrice du plan pour un abonnement TRIAL/ACTIVE", () => {
  assert.equal(hasFeature({ planCode: "BUSINESS", status: "ACTIVE" }, "VOICE"), true);
  assert.equal(hasFeature({ planCode: "STARTER", status: "TRIAL" }, "VOICE"), false);
  assert.equal(hasFeature({ planCode: "STARTER", status: "TRIAL" }, "AI"), true);
});

test("§19 : PAST_DUE garde l'accès (pas de coupure brutale), CANCELLED/SUSPENDED non", () => {
  assert.equal(hasFeature({ planCode: "PRO", status: "PAST_DUE" }, "MARKETING"), true);
  assert.equal(hasFeature({ planCode: "PRO", status: "CANCELLED" }, "MARKETING"), false);
  assert.equal(hasFeature({ planCode: "PRO", status: "SUSPENDED" }, "AI"), false);
});

test("override d'abonnement prioritaire sur la matrice du plan", () => {
  assert.equal(
    hasFeature({ planCode: "STARTER", status: "ACTIVE", featureOverrides: { VOICE: true } }, "VOICE"),
    true,
  );
  assert.equal(
    hasFeature({ planCode: "PRO", status: "ACTIVE", featureOverrides: { MARKETING: false } }, "MARKETING"),
    false,
  );
});

test("sans abonnement → aucune feature", () => {
  assert.equal(hasFeature(null, "AI"), false);
});

test("planHasFeature + message d'indisponibilité", () => {
  assert.equal(planHasFeature("PRO", "LANGUAGE_ADVANCED"), true);
  assert.equal(planHasFeature("STARTER", "LANGUAGE_ADVANCED"), false);
  assert.match(featureUnavailableMessage("VOICE"), /Djeli Voice/);
});
