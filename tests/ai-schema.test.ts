import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aiTurnPlanSchema,
  safeParseTurnPlan,
  AI_TOOL_NAMES,
} from "../src/server/ai/schema.ts";
import { isAiIntent, intentIsReadOnly } from "../src/server/ai/intents.ts";
import { detectLanguage } from "../src/server/ai/language.ts";

test("plan valide accepté ; défauts appliqués", () => {
  const p = aiTurnPlanSchema.parse({
    intent: "PRODUCT_AVAILABILITY",
    confidence: "HIGH",
  });
  assert.equal(p.language, "AUTO");
  assert.deepEqual(p.toolRequests, []);
  assert.equal(p.handoff, false);
});

test("outil hors liste blanche rejeté", () => {
  const r = aiTurnPlanSchema.safeParse({
    intent: "UNKNOWN",
    confidence: "LOW",
    toolRequests: [{ tool: "dropAllTables", args: {} }],
  });
  assert.equal(r.success, false);
});

test("liste blanche = exactement les outils de lecture", () => {
  assert.ok(AI_TOOL_NAMES.includes("searchProducts"));
  assert.ok(AI_TOOL_NAMES.includes("getDebtsOverview"));
  assert.ok(!(AI_TOOL_NAMES as readonly string[]).includes("prepareOrderDraft"));
  assert.ok(!(AI_TOOL_NAMES as readonly string[]).includes("recordPayment"));
});

test("safeParseTurnPlan : sortie cassée → handoff sûr", () => {
  const p = safeParseTurnPlan("pas du json");
  assert.equal(p.handoff, true);
  assert.equal(p.intent, "UNKNOWN");
});

test("intents : garde de type + lecture seule", () => {
  assert.equal(isAiIntent("DEBT_QUERY"), true);
  assert.equal(isAiIntent("NOPE"), false);
  assert.equal(intentIsReadOnly("DEBT_QUERY"), true);
  assert.equal(intentIsReadOnly("ORDER_REQUEST"), false);
});

test("détection de langue FR / BM / AUTO", () => {
  assert.equal(detectLanguage("Bonjour, vous avez du sucre ?"), "FR");
  assert.equal(detectLanguage("aw ni sɔgɔma, sukaro be yen wa"), "BM");
  assert.equal(detectLanguage("xyz 123"), "AUTO");
});
