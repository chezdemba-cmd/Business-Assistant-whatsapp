import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWhatsAppWebhook } from "../src/server/whatsapp/webhook-parser.ts";

function inboundPayload() {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "22376000000",
                phone_number_id: "PNID_ORG_A",
              },
              contacts: [{ profile: { name: "Aminata" }, wa_id: "22378441209" }],
              messages: [
                {
                  from: "22378441209",
                  id: "wamid.ABC",
                  timestamp: "1756382400",
                  type: "text",
                  text: { body: "Bonjour, 6 sacs SVP" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

test("normalisation d'un message texte entrant", () => {
  const parsed = parseWhatsAppWebhook(inboundPayload());
  assert.equal(parsed.object, "whatsapp_business_account");
  assert.equal(parsed.events.length, 1);
  const ev = parsed.events[0]!;
  assert.equal(ev.phoneNumberId, "PNID_ORG_A");
  assert.equal(ev.displayPhoneNumber, "22376000000");
  assert.equal(ev.contactName, "Aminata");
  assert.equal(ev.contactWaId, "22378441209");
  assert.equal(ev.messages.length, 1);
  const m = ev.messages[0]!;
  assert.equal(m.externalMessageId, "wamid.ABC");
  assert.equal(m.from, "22378441209");
  assert.equal(m.type, "TEXT");
  assert.equal(m.text, "Bonjour, 6 sacs SVP");
  assert.equal(m.timestamp?.toISOString(), new Date(1756382400 * 1000).toISOString());
});

test("média entrant : id + mime stockés, pas de body", () => {
  const p = inboundPayload();
  p.entry[0]!.changes[0]!.value.messages = [
    {
      from: "22378441209",
      id: "wamid.IMG",
      timestamp: "1756382400",
      type: "image",
      // @ts-expect-error payload libre de test
      image: { id: "MEDIA_1", mime_type: "image/jpeg", caption: "reçu abîmé" },
    },
  ];
  const m = parseWhatsAppWebhook(p).events[0]!.messages[0]!;
  assert.equal(m.type, "IMAGE");
  assert.equal(m.mediaId, "MEDIA_1");
  assert.equal(m.mediaMimeType, "image/jpeg");
  assert.equal(m.mediaCaption, "reçu abîmé");
  assert.equal(m.text, null);
});

test("audio reconnu (préparation Phase 6)", () => {
  const p = inboundPayload();
  p.entry[0]!.changes[0]!.value.messages = [
    {
      from: "22378441209",
      id: "wamid.AUD",
      timestamp: "1756382400",
      type: "audio",
      // @ts-expect-error payload libre de test
      audio: { id: "AUD_1", mime_type: "audio/ogg" },
    },
  ];
  const m = parseWhatsAppWebhook(p).events[0]!.messages[0]!;
  assert.equal(m.type, "AUDIO");
  assert.equal(m.mediaId, "AUD_1");
});

test("statuts sortants normalisés + erreurs", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "PNID_ORG_A" },
              statuses: [
                { id: "wamid.OUT1", status: "delivered", timestamp: "1756382500", recipient_id: "22378441209" },
                {
                  id: "wamid.OUT2",
                  status: "failed",
                  timestamp: "1756382600",
                  recipient_id: "22378441209",
                  errors: [{ code: 131047, title: "Re-engagement message" }],
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const ev = parseWhatsAppWebhook(payload).events[0]!;
  assert.equal(ev.statuses.length, 2);
  assert.equal(ev.statuses[0]!.status, "DELIVERED");
  assert.equal(ev.statuses[1]!.status, "FAILED");
  assert.equal(ev.statuses[1]!.errorCode, "131047");
  assert.equal(ev.statuses[1]!.errorMessage, "Re-engagement message");
});

test("payload vide / invalide → aucun événement, pas d'exception", () => {
  assert.deepEqual(parseWhatsAppWebhook(null).events, []);
  assert.deepEqual(parseWhatsAppWebhook({}).events, []);
  assert.deepEqual(parseWhatsAppWebhook({ entry: [{ changes: [{ field: "account_review" }] }] }).events, []);
});
