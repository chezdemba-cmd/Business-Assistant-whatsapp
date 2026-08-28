import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSuperAdminUser,
  parseAllowlist,
} from "../src/server/admin/superadmin.ts";

test("§22 : opérateur via le flag DB", () => {
  assert.equal(
    isSuperAdminUser({ isSuperAdmin: true, email: "x@djeli.co" }, new Set()),
    true,
  );
});

test("§22 : opérateur via l'allowlist d'e-mails (insensible à la casse)", () => {
  const list = parseAllowlist(" ops@djeli.co , Boss@Djeli.CO ");
  assert.equal(isSuperAdminUser({ isSuperAdmin: false, email: "ops@djeli.co" }, list), true);
  assert.equal(isSuperAdminUser({ isSuperAdmin: false, email: "BOSS@djeli.co" }, list), true);
});

test("§22 : un admin d'organisation lambda n'est PAS opérateur", () => {
  const list = parseAllowlist("ops@djeli.co");
  assert.equal(isSuperAdminUser({ isSuperAdmin: false, email: "moussa@boutique.ml" }, list), false);
});

test("allowlist vide / absente", () => {
  assert.equal(parseAllowlist(undefined).size, 0);
  assert.equal(parseAllowlist("").size, 0);
  assert.equal(parseAllowlist(",  ,").size, 0);
});
