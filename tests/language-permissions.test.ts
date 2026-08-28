import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientCan,
  isLanguagePermission,
  LANGUAGE_PERMISSIONS,
  BUSINESS_CONNECTOR_PERMISSIONS,
} from "../src/language-core/permissions.ts";

test("catalogue de permissions figé", () => {
  assert.ok(LANGUAGE_PERMISSIONS.includes("language.read"));
  assert.ok(LANGUAGE_PERMISSIONS.includes("language.validate"));
  assert.ok(LANGUAGE_PERMISSIONS.includes("language.export"));
  assert.equal(isLanguagePermission("language.read"), true);
  assert.equal(isLanguagePermission("language.destroy"), false);
});

test("clientCan : exact match requis", () => {
  assert.equal(clientCan(["language.read"], "language.read"), true);
  assert.equal(clientCan(["language.read"], "language.write"), false);
});

test("§57 : le connecteur Business n'a PAS le droit de valider", () => {
  assert.equal(BUSINESS_CONNECTOR_PERMISSIONS.includes("language.validate"), false);
  assert.equal(clientCan(BUSINESS_CONNECTOR_PERMISSIONS, "language.validate"), false);
  assert.equal(clientCan(BUSINESS_CONNECTOR_PERMISSIONS, "language.read"), true);
});
