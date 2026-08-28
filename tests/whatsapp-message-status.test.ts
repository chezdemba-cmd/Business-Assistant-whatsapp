import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeMessageStatus } from "../src/server/whatsapp/message-status.ts";

test("progression normale QUEUED → SENT → DELIVERED → READ", () => {
  assert.equal(mergeMessageStatus("QUEUED", "SENT"), "SENT");
  assert.equal(mergeMessageStatus("SENT", "DELIVERED"), "DELIVERED");
  assert.equal(mergeMessageStatus("DELIVERED", "READ"), "READ");
});

test("pas de régression : SENT reçu après READ → reste READ", () => {
  assert.equal(mergeMessageStatus("READ", "SENT"), "READ");
  assert.equal(mergeMessageStatus("DELIVERED", "SENT"), "DELIVERED");
  assert.equal(mergeMessageStatus("READ", "DELIVERED"), "READ");
});

test("FAILED s'applique avant livraison, pas après", () => {
  assert.equal(mergeMessageStatus("SENT", "FAILED"), "FAILED");
  assert.equal(mergeMessageStatus("QUEUED", "FAILED"), "FAILED");
  assert.equal(mergeMessageStatus("DELIVERED", "FAILED"), "DELIVERED");
  assert.equal(mergeMessageStatus("READ", "FAILED"), "READ");
});

test("statuts terminaux stables", () => {
  assert.equal(mergeMessageStatus("FAILED", "SENT"), "FAILED");
  assert.equal(mergeMessageStatus("FAILED", "DELIVERED"), "FAILED");
  assert.equal(mergeMessageStatus("RECEIVED", "READ"), "RECEIVED");
});
