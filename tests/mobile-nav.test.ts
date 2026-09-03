import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mobileBottomNav,
  mobileMoreItems,
  isNavActive,
} from "../src/lib/mobile-nav.ts";

test("§4 : bottom-nav ≤ 5 entrées, avec Accueil + FEREDRON + Plus", () => {
  const owner = mobileBottomNav("OWNER");
  assert.ok(owner.length <= 5);
  const keys = owner.map((i) => i.key);
  assert.ok(keys.includes("home"));
  assert.ok(keys.includes("feredron"));
  assert.ok(keys.includes("more"));
});

test("§5 : l'entrée FEREDRON est primaire et pointe vers /ai", () => {
  const feredron = mobileBottomNav("OWNER").find((i) => i.key === "feredron");
  assert.equal(feredron?.primary, true);
  assert.equal(feredron?.href, "/ai");
});

test("les entrées sont filtrées par permission de rôle", () => {
  const employee = mobileBottomNav("EMPLOYEE").map((i) => i.key);
  // EMPLOYEE : pas de debts.write ni ai.use forcément — mais orders.read/customers.read oui
  assert.ok(employee.includes("home"));
  // SALES voit discussions + commandes + FEREDRON
  const sales = mobileBottomNav("SALES").map((i) => i.key);
  assert.ok(sales.includes("conversations"));
  assert.ok(sales.includes("orders"));
});

test("§4 : la feuille « Plus » contient le reste (stock, créances, paramètres…)", () => {
  const more = mobileMoreItems("OWNER").map((i) => i.key);
  assert.ok(more.includes("stock"));
  assert.ok(more.includes("debts"));
  assert.ok(more.includes("customers"));
  assert.ok(more.includes("settings"));
  // un rôle SALES n'y voit pas les paramètres
  const salesMore = mobileMoreItems("SALES").map((i) => i.key);
  assert.ok(!salesMore.includes("settings"));
});

test("isNavActive : préfixe de route", () => {
  const orders = { key: "orders", label: "", href: "/orders", match: ["/orders"] };
  assert.equal(isNavActive(orders, "/orders"), true);
  assert.equal(isNavActive(orders, "/orders/123"), true);
  assert.equal(isNavActive(orders, "/orders-archive"), false);
  assert.equal(isNavActive(orders, "/dashboard"), false);
});
