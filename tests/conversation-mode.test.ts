import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextModeOnHumanReply,
  CONVERSATION_MODE_LABEL,
} from "../src/server/whatsapp/conversation-mode.ts";

test("réponse humaine dans une conversation AUTO → bascule HUMAN", () => {
  assert.equal(nextModeOnHumanReply("AUTO"), "HUMAN");
});

test("réponse humaine en HUMAN ou PAUSED → inchangé", () => {
  assert.equal(nextModeOnHumanReply("HUMAN"), "HUMAN");
  assert.equal(nextModeOnHumanReply("PAUSED"), "PAUSED");
});

test("libellés FR de la maquette", () => {
  assert.equal(CONVERSATION_MODE_LABEL.AUTO, "AUTO");
  assert.equal(CONVERSATION_MODE_LABEL.HUMAN, "HUMAIN");
  assert.equal(CONVERSATION_MODE_LABEL.PAUSED, "EN PAUSE");
});
