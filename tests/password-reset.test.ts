import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { createHmac } from "node:crypto";

process.env.AUTH_SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET ?? "test-secret-test-secret-test-secret-1234";

const {
  issuePasswordResetToken,
  verifyPasswordResetToken,
  resetTokenMatchesAccount,
} = await import("../src/server/auth/password-reset.ts");

test("round-trip : token émis → claims valides", async () => {
  const pwAt = new Date("2026-08-01T10:00:00Z");
  const token = await issuePasswordResetToken("user_1", pwAt);
  const claims = await verifyPasswordResetToken(token);
  assert.ok(claims);
  assert.equal(claims!.userId, "user_1");
  assert.equal(claims!.pwAtMs, pwAt.getTime());
});

test("passwordChangedAt null → pwAtMs = 0", async () => {
  const token = await issuePasswordResetToken("user_2", null);
  const claims = await verifyPasswordResetToken(token);
  assert.equal(claims!.pwAtMs, 0);
});

test("usage unique : le token ne correspond plus après changement de mot de passe", async () => {
  const before = new Date("2026-08-01T10:00:00Z");
  const token = await issuePasswordResetToken("user_3", before);
  const claims = await verifyPasswordResetToken(token);
  assert.equal(resetTokenMatchesAccount(claims!, before), true);
  // Après reset : passwordChangedAt a changé → token caduc.
  assert.equal(resetTokenMatchesAccount(claims!, new Date("2026-08-01T11:00:00Z")), false);
});

test("token altéré → null", async () => {
  const token = await issuePasswordResetToken("user_4", null);
  const tampered = token.slice(0, -3) + (token.endsWith("aaa") ? "bbb" : "aaa");
  assert.equal(await verifyPasswordResetToken(tampered), null);
});

test("séparation de domaine : un JWT signé avec la clé de session est rejeté", async () => {
  // Clé de session = AUTH_SESSION_SECRET brut ; la clé de reset en est dérivée.
  const sessionKey = new TextEncoder().encode(process.env.AUTH_SESSION_SECRET);
  const sessionToken = await new SignJWT({ purpose: "pwreset", pwAt: 0 })
    .setSubject("user_5")
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(sessionKey);
  assert.equal(await verifyPasswordResetToken(sessionToken), null);
});

test("mauvais purpose → null", async () => {
  const resetKey = new Uint8Array(
    createHmac("sha256", process.env.AUTH_SESSION_SECRET!)
      .update("djeli/password-reset/v1")
      .digest(),
  );
  const wrongPurpose = await new SignJWT({ purpose: "session", pwAt: 0 })
    .setSubject("user_6")
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(resetKey);
  assert.equal(await verifyPasswordResetToken(wrongPurpose), null);
});

test("token expiré → null", async () => {
  const resetKey = new Uint8Array(
    createHmac("sha256", process.env.AUTH_SESSION_SECRET!)
      .update("djeli/password-reset/v1")
      .digest(),
  );
  const expired = await new SignJWT({ purpose: "pwreset", pwAt: 0 })
    .setSubject("user_7")
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(resetKey);
  assert.equal(await verifyPasswordResetToken(expired), null);
});
