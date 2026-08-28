import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyMetaSignature,
  verifyWebhookSubscription,
} from "../src/server/whatsapp/signature.ts";

const SECRET = "test-app-secret";
const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
const goodSig =
  "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex");

test("signature valide acceptée", () => {
  assert.equal(verifyMetaSignature(body, goodSig, SECRET), true);
});

test("signature invalide rejetée", () => {
  assert.equal(verifyMetaSignature(body, "sha256=deadbeef", SECRET), false);
  assert.equal(
    verifyMetaSignature(body + " ", goodSig, SECRET),
    false,
    "corps altéré → rejet",
  );
  assert.equal(verifyMetaSignature(body, goodSig, "autre-secret"), false);
});

test("signature absente ou mal formée rejetée", () => {
  assert.equal(verifyMetaSignature(body, null, SECRET), false);
  assert.equal(verifyMetaSignature(body, "", SECRET), false);
  assert.equal(verifyMetaSignature(body, goodSig.replace("sha256=", ""), SECRET), false);
  assert.equal(verifyMetaSignature(body, goodSig, null), false);
});

test("handshake GET : challenge renvoyé si token correct", () => {
  assert.equal(
    verifyWebhookSubscription(
      { mode: "subscribe", token: "verif", challenge: "1234" },
      "verif",
    ),
    "1234",
  );
});

test("handshake GET : refus si token faux, mode faux, ou non configuré", () => {
  assert.equal(
    verifyWebhookSubscription(
      { mode: "subscribe", token: "x", challenge: "1234" },
      "verif",
    ),
    null,
  );
  assert.equal(
    verifyWebhookSubscription(
      { mode: "unsubscribe", token: "verif", challenge: "1234" },
      "verif",
    ),
    null,
  );
  assert.equal(
    verifyWebhookSubscription(
      { mode: "subscribe", token: "verif", challenge: "1234" },
      undefined,
    ),
    null,
  );
});
