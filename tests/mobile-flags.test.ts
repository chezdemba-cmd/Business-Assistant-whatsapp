import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMobileFlags } from "../src/lib/flags.ts";

test("§84 : défauts — PWA activée, natif et push désactivés", () => {
  const f = resolveMobileFlags({});
  assert.deepEqual(f, { PWA: true, MOBILE_NATIVE: false, PUSH_NOTIFICATIONS: false });
});

test("PWA désactivable explicitement", () => {
  assert.equal(resolveMobileFlags({ NEXT_PUBLIC_PWA_ENABLED: "0" }).PWA, false);
  assert.equal(resolveMobileFlags({ NEXT_PUBLIC_PWA_ENABLED: "false" }).PWA, false);
  assert.equal(resolveMobileFlags({ NEXT_PUBLIC_PWA_ENABLED: "1" }).PWA, true);
});

test("valeurs truthy tolérantes pour natif / push", () => {
  for (const v of ["1", "true", "on", "YES"]) {
    assert.equal(resolveMobileFlags({ NEXT_PUBLIC_MOBILE_NATIVE: v }).MOBILE_NATIVE, true);
  }
  for (const v of ["0", "false", "", "nope"]) {
    assert.equal(resolveMobileFlags({ NEXT_PUBLIC_PUSH_NOTIFICATIONS: v }).PUSH_NOTIFICATIONS, false);
  }
});
