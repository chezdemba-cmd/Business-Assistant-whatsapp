import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Clé de test (32 octets base64) AVANT import du module.
process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const { encryptSecret, decryptSecret, isSecretCryptoConfigured } = await import(
  "../src/server/whatsapp/crypto.ts"
);

test("aller-retour chiffrement / déchiffrement", () => {
  const token = "EAABsomeMetaAccessToken1234567890";
  const enc = encryptSecret(token);
  assert.notEqual(enc, token);
  assert.match(enc, /^v1:/);
  assert.equal(decryptSecret(enc), token);
});

test("deux chiffrements du même texte diffèrent (IV aléatoire)", () => {
  assert.notEqual(encryptSecret("x"), encryptSecret("x"));
});

test("altération du ciphertext → échec d'authentification GCM", () => {
  const enc = encryptSecret("secret");
  const parts = enc.split(":");
  const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${Buffer.from("zzzz").toString("base64")}`;
  assert.throws(() => decryptSecret(tampered));
});

test("format invalide rejeté", () => {
  assert.throws(() => decryptSecret("not-a-valid-payload"));
  assert.throws(() => decryptSecret("v2:a:b:c"));
});

test("isSecretCryptoConfigured reflète la présence de la clé", () => {
  assert.equal(isSecretCryptoConfigured(), true);
});
