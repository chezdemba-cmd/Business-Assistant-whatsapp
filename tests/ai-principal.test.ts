import { test } from "node:test";
import assert from "node:assert/strict";
import { principalCan } from "../src/server/ai/principal.ts";

const systemAi = { kind: "SYSTEM_AI", conversationCustomerId: "cust-1" } as const;
const ownerUser = { kind: "USER", userId: "u1", role: "OWNER" } as const;
const salesUser = { kind: "USER", userId: "u2", role: "SALES" } as const;

test("SYSTEM_AI : lecture catalogue / stock / clients / commandes + envoi conversation", () => {
  assert.equal(principalCan(systemAi, "catalog.read"), true);
  assert.equal(principalCan(systemAi, "stock.read"), true);
  assert.equal(principalCan(systemAi, "customers.read"), true);
  assert.equal(principalCan(systemAi, "orders.read"), true);
  assert.equal(principalCan(systemAi, "conversations.write"), true);
});

test("SYSTEM_AI : AUCUN accès paiements / stock write / dettes / membres / settings", () => {
  assert.equal(principalCan(systemAi, "debts.read"), false);
  assert.equal(principalCan(systemAi, "debts.write"), false);
  assert.equal(principalCan(systemAi, "stock.write"), false);
  assert.equal(principalCan(systemAi, "orders.write"), false);
  assert.equal(principalCan(systemAi, "catalog.write"), false);
  assert.equal(principalCan(systemAi, "members.read"), false);
  assert.equal(principalCan(systemAi, "settings.update"), false);
  assert.equal(principalCan(systemAi, "billing.manage"), false);
});

test("USER : hérite des permissions de son rôle", () => {
  assert.equal(principalCan(ownerUser, "debts.read"), true);
  assert.equal(principalCan(ownerUser, "settings.update"), true);
  assert.equal(principalCan(salesUser, "orders.read"), true);
  assert.equal(principalCan(salesUser, "stock.read"), false);
  assert.equal(principalCan(salesUser, "settings.update"), false);
});
