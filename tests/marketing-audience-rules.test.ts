import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAudiencePlan } from "../src/server/marketing/audience-rules.ts";

const NOW = new Date("2026-08-27T12:00:00Z");

test("§23 : INACTIVE_CUSTOMERS → cible les clients avec une commande livrée mais aucune récente", () => {
  const plan = buildAudiencePlan("INACTIVE_CUSTOMERS", { inactiveDays: 60 }, NOW);
  const orders = plan.where.orders as Record<string, unknown>;
  assert.ok(orders.some, "doit exiger au moins une commande livrée");
  assert.ok(orders.none, "doit exclure les commandes livrées récentes");
  assert.match(plan.label, /60 jours/);
});

test("§23 : CUSTOMER_TYPE applique le filtre de type", () => {
  const plan = buildAudiencePlan("CUSTOMER_TYPE", { customerType: "WHOLESALE" }, NOW);
  assert.equal((plan.where as Record<string, unknown>).customerType, "WHOLESALE");
});

test("§23 : AREA cherche zone OU ville, insensible à la casse", () => {
  const plan = buildAudiencePlan("AREA", { area: "Badalabougou" }, NOW);
  assert.ok(Array.isArray((plan.where as Record<string, unknown>).OR));
});

test("§47 : PRODUCT_BUYERS cible les acheteurs d'un produit (commande livrée)", () => {
  const plan = buildAudiencePlan("PRODUCT_BUYERS", { productId: "prod_1" }, NOW);
  const orders = plan.where.orders as Record<string, unknown>;
  assert.ok(orders.some);
});

test("toutes les audiences restreignent aux clients ACTIVE", () => {
  for (const t of ["INACTIVE_CUSTOMERS", "CUSTOMER_TYPE", "AREA", "PRODUCT_BUYERS", "ALL_OPTED_IN", "CUSTOM"] as const) {
    const plan = buildAudiencePlan(t, {}, NOW);
    assert.equal((plan.where as Record<string, unknown>).status, "ACTIVE");
  }
});

test("minSpent → post-filtrage requis", () => {
  const plan = buildAudiencePlan("ALL_OPTED_IN", { minSpent: 50_000 }, NOW);
  assert.equal(plan.needsPostFilter, true);
});
