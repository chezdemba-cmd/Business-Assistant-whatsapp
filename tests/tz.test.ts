import { test } from "node:test";
import assert from "node:assert/strict";
import { todayRange } from "../src/lib/tz.ts";

const DAY = 24 * 60 * 60 * 1000;

test("fenêtre du jour = 24 h exactes", () => {
  const { gte, lt } = todayRange("Africa/Bamako");
  assert.equal(lt.getTime() - gte.getTime(), DAY);
});

test("Africa/Bamako (UTC+0) : minuit UTC", () => {
  const now = new Date("2026-05-15T09:30:00.000Z");
  const { gte, lt } = todayRange("Africa/Bamako", now);
  assert.equal(gte.toISOString(), "2026-05-15T00:00:00.000Z");
  assert.equal(lt.toISOString(), "2026-05-16T00:00:00.000Z");
  assert.ok(now >= gte && now < lt);
});

test("Europe/Paris : décalage appliqué (le 'jour' ne commence pas à minuit UTC)", () => {
  // 15 mai 2026, Paris est en CEST (UTC+2) → minuit local = 22:00 UTC la veille.
  const now = new Date("2026-05-15T09:30:00.000Z");
  const { gte, lt } = todayRange("Europe/Paris", now);
  assert.equal(lt.getTime() - gte.getTime(), DAY);
  assert.equal(gte.toISOString(), "2026-05-14T22:00:00.000Z");
  assert.ok(now >= gte && now < lt);
});

test("fuseau inconnu → repli UTC sans erreur", () => {
  const { gte, lt } = todayRange("Not/AZone");
  assert.equal(lt.getTime() - gte.getTime(), DAY);
});
