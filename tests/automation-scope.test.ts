import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canSeeRecommendation,
  recommendationScopeWhere,
} from "../src/server/automations/scope.ts";

test("§41 / §42 : OWNER / ADMIN / MANAGER voient toute l'organisation", () => {
  for (const role of ["OWNER", "ADMIN", "MANAGER"] as const) {
    assert.deepEqual(recommendationScopeWhere(role, "u1"), {});
  }
});

test("§66 : SALES / EMPLOYEE ne voient que leurs recommandations", () => {
  assert.deepEqual(recommendationScopeWhere("SALES", "u_sales"), { ownerUserId: "u_sales" });
  assert.deepEqual(recommendationScopeWhere("EMPLOYEE", "u_emp"), { ownerUserId: "u_emp" });
});

test("§66 : canSeeRecommendation applique le périmètre", () => {
  assert.equal(canSeeRecommendation("SALES", "u1", { ownerUserId: "u1" }), true);
  assert.equal(canSeeRecommendation("SALES", "u1", { ownerUserId: "u2" }), false);
  // Recommandation globale (stock, résumé) : invisible pour un SALES.
  assert.equal(canSeeRecommendation("SALES", "u1", { ownerUserId: null }), false);
  // Visible pour un rôle large.
  assert.equal(canSeeRecommendation("MANAGER", "u1", { ownerUserId: null }), true);
});
