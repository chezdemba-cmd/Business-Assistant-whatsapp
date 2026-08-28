import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolutionOrder,
  RESOLVABLE_STATUSES,
} from "../src/language-core/scope-priority.ts";

const ALL = ["ORGANIZATION", "DOMAIN", "GLOBAL"] as const;

test("§53 priorité : ORGANIZATION → DOMAIN → GLOBAL", () => {
  const order = resolutionOrder({
    organizationId: "org-A",
    domainCode: "commerce",
    allowedScopes: [...ALL],
  });
  assert.deepEqual(order.map((q) => q.scope), ["ORGANIZATION", "DOMAIN", "GLOBAL"]);
  assert.equal(order[0]!.organizationId, "org-A");
  assert.equal(order[1]!.domainCode, "commerce");
});

test("sans organizationId → pas d'étape ORGANIZATION (§52)", () => {
  const order = resolutionOrder({ domainCode: "commerce", allowedScopes: [...ALL] });
  assert.deepEqual(order.map((q) => q.scope), ["DOMAIN", "GLOBAL"]);
});

test("scopes non autorisés exclus", () => {
  const order = resolutionOrder({
    organizationId: "org-A",
    domainCode: "commerce",
    allowedScopes: ["GLOBAL"],
  });
  assert.deepEqual(order.map((q) => q.scope), ["GLOBAL"]);
});

test("resolve standard ne sert que VALIDATED (§54)", () => {
  assert.deepEqual([...RESOLVABLE_STATUSES], ["VALIDATED"]);
});
