import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isCustomerServiceWindowOpen,
  serviceWindowRemainingMs,
  SERVICE_WINDOW_MS,
} from "../src/server/whatsapp/service-window.ts";

const now = new Date("2026-08-28T12:00:00Z");

test("fenêtre 24 h : 23 h 59 → ouverte, 24 h 01 → fermée", () => {
  const at23h59 = new Date(now.getTime() - (23 * 60 + 59) * 60 * 1000);
  const at24h01 = new Date(now.getTime() - (24 * 60 + 1) * 60 * 1000);
  assert.equal(isCustomerServiceWindowOpen(at23h59, now), true);
  assert.equal(isCustomerServiceWindowOpen(at24h01, now), false);
});

test("exactement 24 h → fermée (borne stricte)", () => {
  const exactly = new Date(now.getTime() - SERVICE_WINDOW_MS);
  assert.equal(isCustomerServiceWindowOpen(exactly, now), false);
});

test("aucun message entrant → fermée", () => {
  assert.equal(isCustomerServiceWindowOpen(null, now), false);
  assert.equal(isCustomerServiceWindowOpen(undefined, now), false);
});

test("temps restant décroît puis tombe à 0", () => {
  const at1h = new Date(now.getTime() - 60 * 60 * 1000);
  assert.equal(
    serviceWindowRemainingMs(at1h, now),
    SERVICE_WINDOW_MS - 60 * 60 * 1000,
  );
  assert.equal(serviceWindowRemainingMs(new Date(now.getTime() - SERVICE_WINDOW_MS - 1), now), 0);
});
