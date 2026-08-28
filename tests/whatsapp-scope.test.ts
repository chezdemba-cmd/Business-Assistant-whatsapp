import { test } from "node:test";
import assert from "node:assert/strict";
import {
  conversationScopeWhere,
  canAccessConversation,
  canAssignConversations,
} from "../src/server/whatsapp/scope.ts";

const SALES = "SALES" as const;
const MANAGER = "MANAGER" as const;
const U1 = "user-1";
const U2 = "user-2";

test("OWNER/ADMIN/MANAGER voient toutes les conversations", () => {
  assert.deepEqual(conversationScopeWhere(MANAGER, U1), {});
  assert.equal(canAssignConversations(MANAGER), true);
});

test("SALES : périmètre = assignée à lui OU client assigné à lui", () => {
  const where = conversationScopeWhere(SALES, U1);
  assert.deepEqual(where, {
    OR: [
      { assignedToUserId: U1 },
      { customer: { assignedToUserId: U1 } },
    ],
  });
  assert.equal(canAssignConversations(SALES), false);
});

test("canAccessConversation : SALES assigné → oui", () => {
  assert.equal(
    canAccessConversation(SALES, U1, { assignedToUserId: U1, customer: null }),
    true,
  );
});

test("canAccessConversation : SALES via client assigné → oui", () => {
  assert.equal(
    canAccessConversation(SALES, U1, {
      assignedToUserId: null,
      customer: { assignedToUserId: U1 },
    }),
    true,
  );
});

test("canAccessConversation : SALES hors périmètre → non", () => {
  assert.equal(
    canAccessConversation(SALES, U1, {
      assignedToUserId: U2,
      customer: { assignedToUserId: U2 },
    }),
    false,
  );
});
