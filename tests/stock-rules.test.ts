import { test } from "node:test";
import assert from "node:assert/strict";
import type { StockMovementType } from "@prisma/client";
import {
  INCOMING_TYPES,
  OUTGOING_TYPES,
  MOVEMENT_TYPES,
  movementSign,
  movementPhysicalDelta,
  computePhysicalStock,
  availableStock,
  stockState,
  STOCK_STATE_LABEL,
  marginOf,
  inventoryAdjustment,
  reversalTypeFor,
  stockValueAtPurchasePrice,
} from "../src/server/stock/movement-rules.ts";

test("signe des mouvements : entrants +1, sortants -1", () => {
  for (const t of INCOMING_TYPES) assert.equal(movementSign(t), 1, t);
  for (const t of OUTGOING_TYPES) assert.equal(movementSign(t), -1, t);
  assert.equal(INCOMING_TYPES.length + OUTGOING_TYPES.length, MOVEMENT_TYPES.length);
});

test("movementPhysicalDelta : quantity positive, signe selon type", () => {
  assert.equal(movementPhysicalDelta("PURCHASE", 80), 80);
  assert.equal(movementPhysicalDelta("SALE", 14), -14);
  assert.equal(movementPhysicalDelta("RETURN_IN", 2), 2);
  assert.equal(movementPhysicalDelta("ADJUSTMENT_OUT", 3), -3);
  assert.equal(movementPhysicalDelta("CANCELLATION", 5), 5);
  assert.equal(movementPhysicalDelta("RETURN_OUT", 4), -4);
});

test("computePhysicalStock — scénario cumulatif du cahier des charges", () => {
  const mv: Array<{ type: StockMovementType; quantity: number }> = [];
  mv.push({ type: "INITIAL", quantity: 40 });
  assert.equal(computePhysicalStock(mv), 40);
  mv.push({ type: "PURCHASE", quantity: 10 });
  assert.equal(computePhysicalStock(mv), 50);
  mv.push({ type: "SALE", quantity: 5 });
  assert.equal(computePhysicalStock(mv), 45);
  mv.push({ type: "ADJUSTMENT_OUT", quantity: 3 });
  assert.equal(computePhysicalStock(mv), 42);
  mv.push({ type: "RETURN_IN", quantity: 2 });
  assert.equal(computePhysicalStock(mv), 44);
});

test("stock disponible = physique - réservé ; RELEASE remet à disposition", () => {
  const physical = 44;
  assert.equal(availableStock(physical, 10), 34);
  assert.equal(availableStock(physical, 0), 44);
  assert.equal(availableStock(5, 8), -3); // anomalie autorisée mathématiquement
});

test("état de stock selon disponible et seuil", () => {
  assert.equal(stockState(20, 10), "IN_STOCK");
  assert.equal(stockState(8, 10), "LOW_STOCK");
  assert.equal(stockState(10, 10), "LOW_STOCK"); // available <= threshold
  assert.equal(stockState(0, 10), "OUT_OF_STOCK");
  assert.equal(stockState(-2, 10), "OUT_OF_STOCK");
  assert.equal(STOCK_STATE_LABEL.LOW_STOCK, "Stock faible");
});

test("marge : gère salePrice = 0 sans division par zéro", () => {
  assert.deepEqual(marginOf(31500, 27200), { amount: 4300, percent: (4300 / 31500) * 100 });
  assert.equal(marginOf(1000, null), null);
  assert.deepEqual(marginOf(0, 0), { amount: 0, percent: null });
  assert.deepEqual(marginOf(0, 500), { amount: -500, percent: null });
});

test("inventoryAdjustment : delta calculé côté serveur", () => {
  assert.deepEqual(inventoryAdjustment(40, 37), { type: "ADJUSTMENT_OUT", quantity: 3 });
  assert.deepEqual(inventoryAdjustment(40, 45), { type: "ADJUSTMENT_IN", quantity: 5 });
  assert.equal(inventoryAdjustment(40, 40), null);
});

test("reversalTypeFor : compensation d'un mouvement", () => {
  assert.equal(reversalTypeFor("PURCHASE"), "ADJUSTMENT_OUT");
  assert.equal(reversalTypeFor("SALE"), "ADJUSTMENT_IN");
  assert.equal(reversalTypeFor("RETURN_IN"), "ADJUSTMENT_OUT");
});

test("stockValueAtPurchasePrice", () => {
  assert.equal(stockValueAtPurchasePrice(42, 27200), 42 * 27200);
  assert.equal(stockValueAtPurchasePrice(42, null), 0);
  assert.equal(stockValueAtPurchasePrice(-3, 100), 0);
});
