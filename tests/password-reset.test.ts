import { test } from "node:test";
import assert from "node:assert/strict";
import { hashResetToken } from "../src/server/auth/password-reset.ts";
import { buildPasswordResetEmail } from "../src/server/email/templates.ts";
import { MockEmailProvider } from "../src/server/email/mock-provider.ts";

test("hashResetToken : SHA-256 hex déterministe, jamais le clair", () => {
  const h = hashResetToken("abc123");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashResetToken("abc123"));
  assert.notEqual(h, hashResetToken("abc124"));
  assert.notEqual(h, "abc123");
});

test("buildPasswordResetEmail : sujet + lien présents, HTML échappé", () => {
  const m = buildPasswordResetEmail({
    firstName: "A<b>",
    resetUrl: "https://app.example/reset-password/tok123",
    ttlMinutes: 60,
  });
  assert.match(m.subject, /FEREDRON/);
  assert.ok(m.text.includes("https://app.example/reset-password/tok123"));
  assert.ok(m.html.includes("https://app.example/reset-password/tok123"));
  assert.ok(m.html.includes("A&lt;b&gt;"), "le prénom est échappé dans le HTML");
  assert.ok(!m.html.includes("A<b>"));
  assert.match(m.text, /60 minutes/);
});

test("MockEmailProvider : n'envoie rien, renvoie un succès", async () => {
  const r = await new MockEmailProvider().send({
    to: "x@y.z",
    subject: "s",
    html: "<p>h</p>",
    text: "t",
  });
  assert.equal(r.ok, true);
});
