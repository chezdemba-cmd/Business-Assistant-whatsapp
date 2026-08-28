import { test } from "node:test";
import assert from "node:assert/strict";
import { isSessionStillValid } from "../src/server/auth/session-policy.ts";

const T0 = new Date("2026-08-28T12:00:00Z").getTime();

test("§5 : session émise après les marqueurs → valide", () => {
  assert.equal(
    isSessionStillValid(T0, { passwordChangedAt: null, sessionInvalidBefore: null }),
    true,
  );
});

test("§5 : session émise AVANT un changement de mot de passe → invalide", () => {
  const pw = new Date(T0 + 60_000);
  assert.equal(isSessionStillValid(T0, { passwordChangedAt: pw, sessionInvalidBefore: null }), false);
});

test("§5 : session émise AVANT une révocation globale → invalide (logout all / appareil compromis)", () => {
  const revoke = new Date(T0 + 60_000);
  assert.equal(isSessionStillValid(T0, { passwordChangedAt: null, sessionInvalidBefore: revoke }), false);
});

test("§5 : session ré-émise après révocation → de nouveau valide", () => {
  const revoke = new Date(T0);
  assert.equal(
    isSessionStillValid(T0 + 5000, { passwordChangedAt: null, sessionInvalidBefore: revoke }),
    true,
  );
});

test("tolérance de 2 s autour du marqueur", () => {
  const mark = new Date(T0);
  assert.equal(isSessionStillValid(T0 - 1000, { passwordChangedAt: mark, sessionInvalidBefore: null }), true);
  assert.equal(isSessionStillValid(T0 - 3000, { passwordChangedAt: mark, sessionInvalidBefore: null }), false);
});
