import { test } from "node:test";
import assert from "node:assert/strict";
import type { Role } from "@prisma/client";
import {
  canSeeAllCrm,
  customerScopeWhere,
  orderScopeWhere,
  canAccessCustomer,
  canActOnOrder,
} from "../src/server/crm/scope.ts";

const BROAD: Role[] = ["OWNER", "ADMIN", "MANAGER"];
const NARROW: Role[] = ["SALES", "EMPLOYEE"];

test("OWNER / ADMIN / MANAGER voient tout le CRM", () => {
  for (const r of BROAD) {
    assert.equal(canSeeAllCrm(r), true, r);
    assert.deepEqual(customerScopeWhere(r, "u1"), {});
    assert.deepEqual(orderScopeWhere(r, "u1"), {});
  }
});

test("SALES / EMPLOYEE : périmètre restreint aux clients assignés", () => {
  for (const r of NARROW) {
    assert.equal(canSeeAllCrm(r), false, r);
    assert.deepEqual(customerScopeWhere(r, "u1"), { assignedToUserId: "u1" });
    assert.deepEqual(orderScopeWhere(r, "u1"), {
      OR: [{ createdByUserId: "u1" }, { customer: { assignedToUserId: "u1" } }],
    });
  }
});

test("canAccessCustomer : SALES seulement sur ses clients", () => {
  const mine = { assignedToUserId: "u1" };
  const other = { assignedToUserId: "u2" };
  assert.equal(canAccessCustomer("SALES", "u1", mine), true);
  assert.equal(canAccessCustomer("SALES", "u1", other), false);
  assert.equal(canAccessCustomer("EMPLOYEE", "u1", other), false);
  assert.equal(canAccessCustomer("MANAGER", "u1", other), true);
  assert.equal(canAccessCustomer("OWNER", "u1", { assignedToUserId: null }), true);
});

test("canActOnOrder : créateur OU client assigné", () => {
  const asCreator = {
    createdByUserId: "u1",
    customer: { assignedToUserId: "u2" },
  };
  const asAssignee = {
    createdByUserId: "u9",
    customer: { assignedToUserId: "u1" },
  };
  const neither = {
    createdByUserId: "u9",
    customer: { assignedToUserId: "u2" },
  };
  assert.equal(canActOnOrder("SALES", "u1", asCreator), true);
  assert.equal(canActOnOrder("SALES", "u1", asAssignee), true);
  assert.equal(canActOnOrder("SALES", "u1", neither), false);
  assert.equal(canActOnOrder("MANAGER", "u1", neither), true);
});
