import { test } from "node:test";
import assert from "node:assert/strict";
import type { OrderStatus } from "@prisma/client";
import {
  ORDER_STATUSES,
  ALLOWED_TRANSITIONS,
  canTransitionOrderStatus,
  nextStatuses,
  isCancellable,
  areItemsEditable,
  releasesReservations,
  fulfillsReservations,
} from "../src/server/orders/order-status.ts";

test("cycle nominal autorisé", () => {
  assert.equal(canTransitionOrderStatus("NEW", "PENDING_CONFIRMATION"), true);
  assert.equal(canTransitionOrderStatus("PENDING_CONFIRMATION", "CONFIRMED"), true);
  assert.equal(canTransitionOrderStatus("CONFIRMED", "PREPARING"), true);
  assert.equal(canTransitionOrderStatus("PREPARING", "OUT_FOR_DELIVERY"), true);
  assert.equal(canTransitionOrderStatus("OUT_FOR_DELIVERY", "DELIVERED"), true);
});

test("transitions interdites", () => {
  assert.equal(canTransitionOrderStatus("DELIVERED", "NEW"), false);
  assert.equal(canTransitionOrderStatus("DELIVERED", "PREPARING"), false);
  assert.equal(canTransitionOrderStatus("CANCELLED", "CONFIRMED"), false);
  assert.equal(canTransitionOrderStatus("REJECTED", "CONFIRMED"), false);
  assert.equal(canTransitionOrderStatus("NEW", "DELIVERED"), false); // pas de saut
  assert.equal(canTransitionOrderStatus("CONFIRMED", "NEW"), false); // pas de retour
  assert.equal(canTransitionOrderStatus("NEW", "NEW"), false); // no-op refusé
});

test("annulation possible tant que non livré, impossible après", () => {
  for (const s of ["NEW", "PENDING_CONFIRMATION", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"] as OrderStatus[]) {
    assert.equal(canTransitionOrderStatus(s, "CANCELLED"), true, s);
  }
  assert.equal(canTransitionOrderStatus("DELIVERED", "CANCELLED"), false);
  assert.equal(isCancellable("DELIVERED"), false);
  assert.equal(isCancellable("PREPARING"), true);
});

test("REJECTED seulement depuis NEW / PENDING_CONFIRMATION", () => {
  assert.equal(canTransitionOrderStatus("NEW", "REJECTED"), true);
  assert.equal(canTransitionOrderStatus("PENDING_CONFIRMATION", "REJECTED"), true);
  assert.equal(canTransitionOrderStatus("CONFIRMED", "REJECTED"), false);
});

test("édition des lignes uniquement en NEW / PENDING_CONFIRMATION", () => {
  assert.equal(areItemsEditable("NEW"), true);
  assert.equal(areItemsEditable("PENDING_CONFIRMATION"), true);
  assert.equal(areItemsEditable("CONFIRMED"), false);
  assert.equal(areItemsEditable("DELIVERED"), false);
});

test("effets sur les réservations", () => {
  assert.equal(releasesReservations("CANCELLED"), true);
  assert.equal(releasesReservations("REJECTED"), true);
  assert.equal(releasesReservations("DELIVERED"), false);
  assert.equal(fulfillsReservations("DELIVERED"), true);
  assert.equal(fulfillsReservations("CANCELLED"), false);
});

test("cohérence ALLOWED_TRANSITIONS", () => {
  for (const from of ORDER_STATUSES) {
    for (const to of ALLOWED_TRANSITIONS[from]) {
      assert.ok(ORDER_STATUSES.includes(to), `${from} -> ${to}`);
      assert.notEqual(from, to);
    }
  }
  assert.deepEqual([...nextStatuses("DELIVERED")], []);
});
