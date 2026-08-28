import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canReceiveMarketing,
  isReachableOnWhatsApp,
  splitAudienceByConsent,
} from "../src/server/marketing/consent.ts";

const active = { marketingOptIn: true, marketingOptOutAt: null, status: "ACTIVE", phone: "+22370000001" };

test("§29 : opt-in + joignable → peut recevoir", () => {
  assert.equal(canReceiveMarketing(active), true);
  assert.equal(isReachableOnWhatsApp(active), true);
});

test("§29 / §67 : opt-out explicite → exclu", () => {
  assert.equal(canReceiveMarketing({ ...active, marketingOptOutAt: new Date() }), false);
  assert.equal(canReceiveMarketing({ ...active, marketingOptIn: false }), false);
});

test("§67 : client archivé → exclu du marketing", () => {
  assert.equal(canReceiveMarketing({ ...active, status: "ARCHIVED" }), false);
});

test("client sans téléphone → injoignable sur WhatsApp", () => {
  assert.equal(isReachableOnWhatsApp({ ...active, phone: null }), false);
  assert.equal(isReachableOnWhatsApp({ ...active, phone: "  " }), false);
});

test("§24 / §27 / §67 : splitAudienceByConsent sépare inclus / opt-out / injoignables", () => {
  const list = [
    { id: "a", marketingOptIn: true, marketingOptOutAt: null, status: "ACTIVE", phone: "+2231" },
    { id: "b", marketingOptIn: false, marketingOptOutAt: null, status: "ACTIVE", phone: "+2232" },
    { id: "c", marketingOptIn: true, marketingOptOutAt: new Date(), status: "ACTIVE", phone: "+2233" },
    { id: "d", marketingOptIn: true, marketingOptOutAt: null, status: "ACTIVE", phone: null },
  ];
  const split = splitAudienceByConsent(list);
  assert.deepEqual(split.included.map((x) => x.id), ["a"]);
  assert.deepEqual(split.excludedOptOut.map((x) => x.id).sort(), ["b", "c"]);
  assert.deepEqual(split.excludedUnreachable.map((x) => x.id), ["d"]);
});
