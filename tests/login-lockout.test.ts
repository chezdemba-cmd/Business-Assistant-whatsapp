import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOGIN_LOCK_THRESHOLD,
  LOGIN_LOCK_MS,
  isAccountLocked,
  lockRemainingMs,
  registerFailedAttempt,
  clearedAttemptState,
  needsClearing,
} from "../src/server/auth/lockout.ts";

const T0 = 1_700_000_000_000;

test("compte non verrouillé par défaut", () => {
  assert.equal(isAccountLocked({ lockedUntil: null }, T0), false);
});

test("verrouillage actif tant que lockedUntil est dans le futur, expire ensuite", () => {
  const locked = { lockedUntil: new Date(T0 + 60_000) };
  assert.equal(isAccountLocked(locked, T0), true);
  assert.equal(isAccountLocked(locked, T0 + 59_999), true);
  assert.equal(isAccountLocked(locked, T0 + 60_000), false); // borne stricte
  assert.equal(isAccountLocked(locked, T0 + 60_001), false);
});

test("lockRemainingMs décroît puis tombe à 0", () => {
  const locked = { lockedUntil: new Date(T0 + 120_000) };
  assert.equal(lockRemainingMs(locked, T0), 120_000);
  assert.equal(lockRemainingMs(locked, T0 + 100_000), 20_000);
  assert.equal(lockRemainingMs(locked, T0 + 200_000), 0);
  assert.equal(lockRemainingMs({ lockedUntil: null }, T0), 0);
});

test("échecs successifs incrémentent le compteur sans verrouiller avant le seuil", () => {
  let state = { failedLoginCount: 0, lockedUntil: null as Date | null };
  for (let i = 1; i < LOGIN_LOCK_THRESHOLD; i++) {
    const next = registerFailedAttempt(state, T0);
    assert.equal(next.failedLoginCount, i);
    assert.equal(next.lockedUntil, null);
    assert.equal(next.justLocked, false);
    state = { failedLoginCount: next.failedLoginCount, lockedUntil: next.lockedUntil };
  }
});

test("le Nᵉ échec verrouille le compte et remet le compteur à zéro", () => {
  const state = { failedLoginCount: LOGIN_LOCK_THRESHOLD - 1, lockedUntil: null as Date | null };
  const next = registerFailedAttempt(state, T0);
  assert.equal(next.justLocked, true);
  assert.equal(next.failedLoginCount, 0);
  assert.ok(next.lockedUntil);
  assert.equal(next.lockedUntil!.getTime(), T0 + LOGIN_LOCK_MS);
});

test("un échec pendant un verrouillage actif ne prolonge pas la durée", () => {
  const lockedUntil = new Date(T0 + LOGIN_LOCK_MS);
  const next = registerFailedAttempt({ failedLoginCount: 0, lockedUntil }, T0 + 1_000);
  assert.equal(next.justLocked, false);
  assert.equal(next.lockedUntil!.getTime(), lockedUntil.getTime());
});

test("après expiration du verrou, un nouvel échec repart d'un compteur à 1", () => {
  const expired = { failedLoginCount: 0, lockedUntil: new Date(T0) };
  const next = registerFailedAttempt(expired, T0 + 1);
  assert.equal(next.failedLoginCount, 1);
  assert.equal(next.lockedUntil, null);
});

test("clearedAttemptState / needsClearing", () => {
  assert.deepEqual(clearedAttemptState(), { failedLoginCount: 0, lockedUntil: null });
  assert.equal(needsClearing({ failedLoginCount: 0, lockedUntil: null }), false);
  assert.equal(needsClearing({ failedLoginCount: 3, lockedUntil: null }), true);
  assert.equal(needsClearing({ failedLoginCount: 0, lockedUntil: new Date(T0) }), true);
});
