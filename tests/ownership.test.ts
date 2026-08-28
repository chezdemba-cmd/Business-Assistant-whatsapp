import { test } from "node:test";
import assert from "node:assert/strict";
import type { Role } from "@prisma/client";
import {
  OWNER_ROLE,
  ASSIGNABLE_ROLES,
  isAssignableRole,
  canAssignRole,
  isOwnerProtected,
  violatesSingleOwner,
} from "../src/server/tenant/ownership-rules.ts";

const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "SALES", "EMPLOYEE"];

test("OWNER n'est jamais un rôle attribuable (invitation / changement de rôle)", () => {
  assert.equal(canAssignRole("OWNER"), false);
  assert.equal(isAssignableRole("OWNER"), false);
  assert.ok(!ASSIGNABLE_ROLES.includes(OWNER_ROLE as never));
});

test("les autres rôles sont attribuables", () => {
  for (const r of ASSIGNABLE_ROLES) {
    assert.equal(canAssignRole(r), true, r);
    assert.equal(isAssignableRole(r), true, r);
  }
});

test("impossible de promouvoir un membre en OWNER : aucun rôle attribuable n'est OWNER", () => {
  for (const r of ASSIGNABLE_ROLES) assert.notEqual(r, "OWNER");
});

test("le propriétaire est protégé contre rétrogradation / suppression / suspension", () => {
  assert.equal(isOwnerProtected("OWNER"), true);
  for (const r of ["ADMIN", "MANAGER", "SALES", "EMPLOYEE"] as Role[]) {
    assert.equal(isOwnerProtected(r), false, r);
  }
});

test("invariant : au plus un OWNER actif par organisation", () => {
  assert.equal(violatesSingleOwner(0), false);
  assert.equal(violatesSingleOwner(1), false);
  assert.equal(violatesSingleOwner(2), true);
  assert.equal(violatesSingleOwner(5), true);
});

test("isAssignableRole rejette les valeurs inconnues", () => {
  assert.equal(isAssignableRole("SUPERADMIN"), false);
  assert.equal(isAssignableRole(""), false);
});

test("couverture : chaque rôle non-OWNER est assignable, OWNER ne l'est pas", () => {
  for (const r of ALL_ROLES) {
    assert.equal(canAssignRole(r), r !== "OWNER", r);
  }
});
