import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cooldownUntil,
  dayPeriodKey,
  hashedDedupeKey,
  isInCooldown,
  recommendationDedupeKey,
} from "../src/server/automations/recommendation-key.ts";

const ORG = "org_1";

test("§36 : même problème → même dedupeKey (une seule recommandation active)", () => {
  const a = recommendationDedupeKey({ organizationId: ORG, type: "LOW_STOCK", entityId: "prod_9" });
  const b = recommendationDedupeKey({ organizationId: ORG, type: "LOW_STOCK", entityId: "prod_9" });
  assert.equal(a, b);
});

test("§36 : problèmes distincts → clés distinctes", () => {
  const a = recommendationDedupeKey({ organizationId: ORG, type: "LOW_STOCK", entityId: "prod_9" });
  const b = recommendationDedupeKey({ organizationId: ORG, type: "LOW_STOCK", entityId: "prod_10" });
  const c = recommendationDedupeKey({ organizationId: ORG, type: "OUT_OF_STOCK", entityId: "prod_9" });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test("§36 : la clé de période sépare les résumés quotidiens", () => {
  const d1 = recommendationDedupeKey({ organizationId: ORG, type: "DAILY_SUMMARY", entityId: null, periodKey: "2026-08-27" });
  const d2 = recommendationDedupeKey({ organizationId: ORG, type: "DAILY_SUMMARY", entityId: null, periodKey: "2026-08-28" });
  assert.notEqual(d1, d2);
});

test("hashedDedupeKey est déterministe et court", () => {
  const k1 = hashedDedupeKey({ organizationId: ORG, type: "OVERDUE_DEBT", entityId: "ord_1" });
  const k2 = hashedDedupeKey({ organizationId: ORG, type: "OVERDUE_DEBT", entityId: "ord_1" });
  assert.equal(k1, k2);
  assert.equal(k1.length, 40);
});

test("§37 : cooldown — pas de recréation tant que la fenêtre n'est pas écoulée", () => {
  const now = new Date("2026-08-27T08:00:00Z");
  const until = cooldownUntil(now, 24);
  assert.ok(until && until.getTime() > now.getTime());

  assert.equal(isInCooldown({ status: "NEW", cooldownUntil: until }, now), true);
  const later = new Date("2026-08-28T09:00:00Z");
  assert.equal(isInCooldown({ status: "NEW", cooldownUntil: until }, later), false);
});

test("§37 : cooldown ignoré si la recommandation a été écartée ou expirée", () => {
  const now = new Date("2026-08-27T08:00:00Z");
  const until = cooldownUntil(now, 24)!;
  assert.equal(isInCooldown({ status: "DISMISSED", cooldownUntil: until }, now), false);
  assert.equal(isInCooldown({ status: "EXPIRED", cooldownUntil: until }, now), false);
  assert.equal(isInCooldown(null, now), false);
});

test("cooldownUntil(0) → null (pas de refroidissement)", () => {
  assert.equal(cooldownUntil(new Date(), 0), null);
});

test("dayPeriodKey rend un jour métier YYYY-MM-DD dans le fuseau", () => {
  // 23:30 UTC le 27 = déjà le 28 à Paris (UTC+2 en été).
  const d = new Date("2026-08-27T23:30:00Z");
  assert.equal(dayPeriodKey(d, "Africa/Bamako"), "2026-08-27");
  assert.equal(dayPeriodKey(d, "Europe/Paris"), "2026-08-28");
});
