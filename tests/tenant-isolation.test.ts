import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateOrganizationAccess,
  type MembershipLike,
} from "../src/server/tenant/access-policy.ts";

/**
 * Isolation multi-tenant.
 *
 * `requireOrganizationAccess(userId, orgId)` charge le membre via la clé
 * unique (organizationId, userId). On simule ici ce lookup avec une Map :
 * l'absence de ligne (cas « membre de A qui cible B ») doit toujours
 * conduire à un refus.
 */
type Row = MembershipLike;

const db = new Map<string, Row>();
const key = (orgId: string, userId: string) => `${orgId}:${userId}`;

// Org A : Alice (ADMIN, active), Org active.
db.set(key("orgA", "alice"), {
  status: "ACTIVE",
  role: "ADMIN",
  organization: { status: "ACTIVE" },
});
// Org B : Bob (OWNER, active), Org active.
db.set(key("orgB", "bob"), {
  status: "ACTIVE",
  role: "OWNER",
  organization: { status: "ACTIVE" },
});
// Org A : Carla suspendue.
db.set(key("orgA", "carla"), {
  status: "SUSPENDED",
  role: "SALES",
  organization: { status: "ACTIVE" },
});
// Org C : Dora, mais l'organisation est suspendue.
db.set(key("orgC", "dora"), {
  status: "ACTIVE",
  role: "OWNER",
  organization: { status: "SUSPENDED" },
});

function resolveAccess(userId: string, orgId: string) {
  return evaluateOrganizationAccess(db.get(key(orgId, userId)) ?? null);
}

test("un membre accède à SA propre organisation", () => {
  const d = resolveAccess("alice", "orgA");
  assert.equal(d.ok, true);
  if (d.ok) assert.equal(d.role, "ADMIN");
});

test("un membre de l'organisation A ne peut PAS accéder à l'organisation B", () => {
  const d = resolveAccess("alice", "orgB");
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.reason, "NOT_A_MEMBER");
});

test("réciproque : Bob (org B) ne peut pas accéder à l'organisation A", () => {
  const d = resolveAccess("bob", "orgA");
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.reason, "NOT_A_MEMBER");
});

test("un membre suspendu est refusé sur sa propre organisation", () => {
  const d = resolveAccess("carla", "orgA");
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.reason, "SUSPENDED");
});

test("une organisation suspendue est indisponible pour son propre OWNER", () => {
  const d = resolveAccess("dora", "orgC");
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.reason, "ORG_INACTIVE");
});

test("un utilisateur inconnu n'accède à aucune organisation", () => {
  for (const org of ["orgA", "orgB", "orgC"]) {
    const d = resolveAccess("intrus", org);
    assert.equal(d.ok, false);
  }
});
