import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDeepLink,
  toDeepLink,
  deepLinkPath,
} from "../src/lib/deep-links.ts";

test("§40 : parse les entités avec id → chemin interne sûr", () => {
  assert.deepEqual(parseDeepLink("djeli://order/abc123"), {
    kind: "order",
    id: "abc123",
    path: "/orders/abc123",
  });
  assert.equal(parseDeepLink("djeli://customer/c_1")?.path, "/customers/c_1");
  assert.equal(parseDeepLink("djeli://chat/42")?.path, "/conversations/42");
  assert.equal(parseDeepLink("djeli://product/p9")?.path, "/catalog/p9");
});

test("§40 : entités sans id", () => {
  assert.equal(parseDeepLink("djeli://recommendations")?.path, "/recommendations");
  assert.equal(parseDeepLink("djeli://debts")?.path, "/debts");
  assert.equal(parseDeepLink("djeli://home")?.path, "/dashboard");
  assert.equal(parseDeepLink("djeli://djeli")?.path, "/ai");
});

test("tolère djeli:/path, la casse, les slashes et la query", () => {
  assert.equal(parseDeepLink("DJELI://Order/123")?.path, "/orders/123");
  assert.equal(parseDeepLink("djeli:/order/123/")?.path, "/orders/123");
  assert.equal(parseDeepLink("djeli://order/123?ref=push#x")?.path, "/orders/123");
});

test("§40 : cible inconnue ou id invalide → null (jamais de navigation arbitraire)", () => {
  assert.equal(parseDeepLink("djeli://admin/1"), null);
  assert.equal(parseDeepLink("djeli://order/../../etc"), null);
  assert.equal(parseDeepLink("djeli://order/"), null);
  assert.equal(parseDeepLink("https://evil.example/order/1"), null);
  assert.equal(parseDeepLink("javascript:alert(1)"), null);
  assert.equal(parseDeepLink(""), null);
});

test("toDeepLink / deepLinkPath (notifications → tap)", () => {
  assert.equal(toDeepLink("order", "123"), "djeli://order/123");
  assert.equal(toDeepLink("recommendations"), "djeli://recommendations");
  assert.equal(toDeepLink("order", "bad id!"), null);
  assert.equal(deepLinkPath("customer", "c1"), "/customers/c1");
  assert.equal(deepLinkPath("nope"), null);
});
