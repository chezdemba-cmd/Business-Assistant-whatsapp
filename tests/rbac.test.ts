import { test } from "node:test";
import assert from "node:assert/strict";
import type { Role } from "@prisma/client";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  can,
  canAll,
  canAny,
  roleAtLeast,
  permissionsOf,
} from "../src/server/rbac/permissions.ts";

const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "SALES", "EMPLOYEE"];

test("OWNER possède toutes les permissions", () => {
  for (const p of PERMISSIONS) assert.equal(can("OWNER", p), true, p);
  assert.equal(permissionsOf("OWNER").length, PERMISSIONS.length);
});

test("chaque rôle a un sous-ensemble valide de permissions", () => {
  for (const role of ALL_ROLES) {
    for (const p of ROLE_PERMISSIONS[role]) {
      assert.ok(PERMISSIONS.includes(p), `${role} -> permission inconnue ${p}`);
    }
  }
});

test("ADMIN ne peut ni supprimer l'organisation ni gérer la facturation", () => {
  assert.equal(can("ADMIN", "organization.delete"), false);
  assert.equal(can("ADMIN", "billing.manage"), false);
  assert.equal(can("ADMIN", "members.invite"), true);
  assert.equal(can("ADMIN", "settings.update"), true);
});

test("MANAGER gère l'opérationnel mais pas l'équipe ni les paramètres", () => {
  assert.equal(can("MANAGER", "orders.write"), true);
  assert.equal(can("MANAGER", "stock.write"), true);
  assert.equal(can("MANAGER", "debts.write"), true);
  assert.equal(can("MANAGER", "members.invite"), false);
  assert.equal(can("MANAGER", "members.update"), false);
  assert.equal(can("MANAGER", "settings.update"), false);
  assert.equal(can("MANAGER", "organization.update"), false);
});

test("SALES : ses clients / commandes / conversations, pas le stock ni les paramètres", () => {
  assert.equal(can("SALES", "customers.write"), true);
  assert.equal(can("SALES", "orders.write"), true);
  assert.equal(can("SALES", "conversations.write"), true);
  assert.equal(can("SALES", "ai.use"), true);
  // Phase 4 : SALES encaisse / relance, mais uniquement dans son périmètre CRM
  // (le scope est vérifié en plus par canActOnOrder / canAccessCustomer).
  assert.equal(can("SALES", "debts.read"), true);
  assert.equal(can("SALES", "debts.write"), true);
  assert.equal(can("SALES", "stock.read"), false);
  assert.equal(can("SALES", "stock.write"), false);
  assert.equal(can("SALES", "catalog.write"), false);
  assert.equal(can("SALES", "settings.read"), false);
});

test("EMPLOYEE est essentiellement en lecture", () => {
  assert.equal(can("EMPLOYEE", "organization.read"), true);
  assert.equal(can("EMPLOYEE", "catalog.read"), true);
  assert.equal(can("EMPLOYEE", "orders.read"), true);
  assert.equal(can("EMPLOYEE", "customers.write"), false);
  assert.equal(can("EMPLOYEE", "orders.write"), false);
  assert.equal(can("EMPLOYEE", "members.read"), false);
  assert.equal(can("EMPLOYEE", "settings.read"), false);
});

test("canAny / canAll", () => {
  assert.equal(canAny("EMPLOYEE", ["orders.write", "orders.read"]), true);
  assert.equal(canAll("EMPLOYEE", ["orders.write", "orders.read"]), false);
  assert.equal(canAll("OWNER", [...PERMISSIONS]), true);
});

test("hiérarchie roleAtLeast", () => {
  assert.equal(roleAtLeast("OWNER", "ADMIN"), true);
  assert.equal(roleAtLeast("ADMIN", "MANAGER"), true);
  assert.equal(roleAtLeast("MANAGER", "ADMIN"), false);
  assert.equal(roleAtLeast("SALES", "SALES"), true);
  assert.equal(roleAtLeast("EMPLOYEE", "MANAGER"), false);
});
