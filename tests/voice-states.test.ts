import { test } from "node:test";
import assert from "node:assert/strict";
import {
  voiceReducer,
  isBusy,
  voiceHint,
  type VoiceState,
} from "../src/lib/voice-states.ts";

function run(events: Parameters<typeof voiceReducer>[1][], from: VoiceState = "IDLE") {
  return events.reduce((s, e) => voiceReducer(s, e), from);
}

test("§20 : parcours nominal IDLE → RECORDING → UPLOADING → TRANSCRIBING → READY", () => {
  const s = run([
    { type: "START" },
    { type: "STOP" },
    { type: "UPLOADED" },
    { type: "TRANSCRIBED", confidence: 0.9, threshold: 0.55 },
  ]);
  assert.equal(s, "READY");
});

test("§22 : confiance sous le seuil → LOW_CONFIDENCE, puis CONFIRM ou EDIT → READY", () => {
  const low = run([
    { type: "START" },
    { type: "STOP" },
    { type: "UPLOADED" },
    { type: "TRANSCRIBED", confidence: 0.4, threshold: 0.55 },
  ]);
  assert.equal(low, "LOW_CONFIDENCE");
  assert.equal(voiceReducer(low, { type: "CONFIRM" }), "READY");
  assert.equal(voiceReducer(low, { type: "EDIT" }), "READY");
});

test("§21 : ERROR depuis n'importe quel état actif → FAILED ; CANCEL/RESET → IDLE", () => {
  assert.equal(voiceReducer("RECORDING", { type: "ERROR" }), "FAILED");
  assert.equal(voiceReducer("TRANSCRIBING", { type: "ERROR" }), "FAILED");
  assert.equal(voiceReducer("RECORDING", { type: "CANCEL" }), "IDLE");
  assert.equal(voiceReducer("LOW_CONFIDENCE", { type: "RESET" }), "IDLE");
});

test("transitions illégales ignorées", () => {
  assert.equal(voiceReducer("IDLE", { type: "STOP" }), "IDLE");
  assert.equal(voiceReducer("UPLOADING", { type: "START" }), "UPLOADING");
  assert.equal(voiceReducer("READY", { type: "TRANSCRIBED", confidence: 1, threshold: 0.5 }), "READY");
});

test("on peut relancer un enregistrement depuis READY / FAILED / LOW_CONFIDENCE", () => {
  assert.equal(voiceReducer("READY", { type: "START" }), "RECORDING");
  assert.equal(voiceReducer("FAILED", { type: "START" }), "RECORDING");
  assert.equal(voiceReducer("LOW_CONFIDENCE", { type: "START" }), "RECORDING");
});

test("isBusy + voiceHint", () => {
  assert.equal(isBusy("RECORDING"), true);
  assert.equal(isBusy("READY"), false);
  assert.match(voiceHint("LOW_CONFIDENCE"), /confirmez|corrigez/i);
});
