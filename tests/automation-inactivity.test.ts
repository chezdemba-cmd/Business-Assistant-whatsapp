import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inactivityTier,
  isInactive,
  isSalesOpportunity,
  typicalIntervalDays,
} from "../src/server/automations/inactivity.ts";

const NOW = new Date("2026-08-27T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

test("§12 : aucune commande livrée depuis le seuil → inactif", () => {
  assert.equal(isInactive(daysAgo(75), NOW, 60), true);
  assert.equal(isInactive(daysAgo(20), NOW, 60), false);
});

test("§64 : un client sans historique de commande livrée n'est pas 'redevenu' inactif", () => {
  assert.equal(isInactive(null, NOW, 60), false);
  assert.equal(isInactive(undefined, NOW, 60), false);
});

test("§12 : palier d'inactivité franchi (le plus élevé)", () => {
  assert.equal(inactivityTier(daysAgo(10), NOW), null);
  assert.equal(inactivityTier(daysAgo(35), NOW), 30);
  assert.equal(inactivityTier(daysAgo(75), NOW), 60);
  assert.equal(inactivityTier(daysAgo(200), NOW), 90);
});

test("§64 : nouvelle commande livrée → plus inactif", () => {
  const before = daysAgo(90);
  assert.equal(isInactive(before, NOW, 60), true);
  const afterNewOrder = daysAgo(2);
  assert.equal(isInactive(afterNewOrder, NOW, 60), false);
});

test("typicalIntervalDays = médiane des écarts, null si < 3 commandes", () => {
  assert.equal(typicalIntervalDays([daysAgo(60), daysAgo(30)]), null);
  const iv = typicalIntervalDays([daysAgo(90), daysAgo(60), daysAgo(30), daysAgo(0)]);
  assert.equal(iv, 30);
});

test("§13 : opportunité — rythme régulier + retard inhabituel, sans être 'inactif pur'", () => {
  // Rythme ~30 j, dernière commande il y a 50 j (≥ 30 × 1.5, < 90).
  const dates = [daysAgo(140), daysAgo(110), daysAgo(80), daysAgo(50)];
  assert.equal(
    isSalesOpportunity({
      lastDeliveredAt: dates[dates.length - 1]!,
      typicalIntervalDays: 30,
      orderCount: dates.length,
      now: NOW,
    }),
    true,
  );
});

test("§13 : pas d'opportunité si historique trop court ou délai normal", () => {
  assert.equal(
    isSalesOpportunity({ lastDeliveredAt: daysAgo(50), typicalIntervalDays: 30, orderCount: 2, now: NOW }),
    false,
  );
  assert.equal(
    isSalesOpportunity({ lastDeliveredAt: daysAgo(20), typicalIntervalDays: 30, orderCount: 5, now: NOW }),
    false,
  );
  // Trop long → relève de l'inactivité, pas de l'opportunité.
  assert.equal(
    isSalesOpportunity({ lastDeliveredAt: daysAgo(200), typicalIntervalDays: 30, orderCount: 5, now: NOW }),
    false,
  );
});
