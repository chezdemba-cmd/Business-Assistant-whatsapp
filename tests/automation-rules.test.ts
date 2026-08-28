import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RULE_TYPES,
  DETECTABLE_RULE_TYPES,
  RULE_META,
  configNumber,
  effectiveRuleConfig,
  ruleDefaultEnabled,
} from "../src/server/automations/rules.ts";

test("§3 : les types détectables n'incluent pas CUSTOM", () => {
  assert.ok(!DETECTABLE_RULE_TYPES.includes("CUSTOM"));
  assert.equal(DETECTABLE_RULE_TYPES.length, 10);
});

test("§59 : AUCUNE règle n'a d'effet externe automatique", () => {
  for (const meta of Object.values(RULE_META)) {
    assert.equal(meta.externalEffect, false);
  }
});

test("§58 : jeu de règles par défaut — INACTIVE_CUSTOMER prudent (OFF)", () => {
  assert.equal(ruleDefaultEnabled("LOW_STOCK"), true);
  assert.equal(ruleDefaultEnabled("OVERDUE_DEBT"), true);
  assert.equal(ruleDefaultEnabled("DAILY_SUMMARY"), true);
  assert.equal(ruleDefaultEnabled("ORDER_STUCK"), true);
  assert.equal(ruleDefaultEnabled("INACTIVE_CUSTOMER"), false);
  assert.equal(ruleDefaultEnabled("SALES_OPPORTUNITY"), false);
  assert.equal(ruleDefaultEnabled("PAYMENT_DUE_SOON"), false);
});

test("DEFAULT_RULE_TYPES == DETECTABLE_RULE_TYPES (CUSTOM créé à part / non)", () => {
  assert.deepEqual([...DEFAULT_RULE_TYPES].sort(), [...DETECTABLE_RULE_TYPES].sort());
});

test("effectiveRuleConfig fusionne la config stockée avec les défauts du type", () => {
  const merged = effectiveRuleConfig("OVERDUE_DEBT", { minDaysOverdue: 14 });
  assert.equal(merged.minDaysOverdue, 14);
  assert.equal(merged.cooldownHours, RULE_META.OVERDUE_DEBT.defaultConfig.cooldownHours);
});

test("effectiveRuleConfig ignore les valeurs non scalaires / entrées invalides", () => {
  const merged = effectiveRuleConfig("LOW_STOCK", { cooldownHours: 12, bogus: { a: 1 }, arr: [1, 2] } as unknown);
  assert.equal(merged.cooldownHours, 12);
  assert.equal("bogus" in merged, false);
  assert.equal("arr" in merged, false);
});

test("configNumber renvoie le défaut si la clé est absente ou non numérique", () => {
  assert.equal(configNumber({ x: 5 }, "x", 1), 5);
  assert.equal(configNumber({}, "x", 7), 7);
  assert.equal(configNumber({ x: "nope" }, "x", 7), 7);
});
