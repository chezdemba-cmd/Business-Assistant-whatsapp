import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeConfidence,
  decidePolicy,
} from "../src/server/ai/confidence.ts";

test("normalizeConfidence : chaînes et nombres", () => {
  assert.equal(normalizeConfidence("HIGH"), "HIGH");
  assert.equal(normalizeConfidence("MEDIUM"), "MEDIUM");
  assert.equal(normalizeConfidence("LOW"), "LOW");
  assert.equal(normalizeConfidence(0.9), "HIGH");
  assert.equal(normalizeConfidence(0.5), "MEDIUM");
  assert.equal(normalizeConfidence(0.2), "LOW");
  assert.equal(normalizeConfidence("bof"), "LOW");
});

const base = {
  intent: "PRODUCT_AVAILABILITY",
  explicitHandoff: false,
  nonTextInbound: false,
  serviceWindowOpen: true,
} as const;

test("LOW → handoff, aucune réponse auto", () => {
  const d = decidePolicy({ ...base, confidence: "LOW" });
  assert.equal(d.autoReply, false);
  assert.equal(d.handoff, true);
  assert.equal(d.allowDraft, false);
});

test("MEDIUM → réponse prudente, pas de brouillon", () => {
  const d = decidePolicy({ ...base, confidence: "MEDIUM" });
  assert.equal(d.autoReply, true);
  assert.equal(d.handoff, false);
  assert.equal(d.allowDraft, false);
});

test("HIGH → réponse auto + brouillon autorisé", () => {
  const d = decidePolicy({ ...base, confidence: "HIGH" });
  assert.equal(d.autoReply, true);
  assert.equal(d.allowDraft, true);
});

test("demande d'humain explicite ou intent HUMAN_REQUEST → handoff", () => {
  assert.equal(
    decidePolicy({ ...base, confidence: "HIGH", explicitHandoff: true }).handoff,
    true,
  );
  assert.equal(
    decidePolicy({ ...base, confidence: "HIGH", intent: "HUMAN_REQUEST" }).handoff,
    true,
  );
});

test("message non textuel → handoff même avec confiance haute", () => {
  const d = decidePolicy({ ...base, confidence: "HIGH", nonTextInbound: true });
  assert.equal(d.handoff, true);
  assert.equal(d.autoReply, false);
});

test("fenêtre 24 h fermée → handoff, pas de texte libre", () => {
  const d = decidePolicy({ ...base, confidence: "HIGH", serviceWindowOpen: false });
  assert.equal(d.handoff, true);
  assert.equal(d.autoReply, false);
});
