import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inactiveCustomerPriority,
  maxPriority,
  orderPendingPriority,
  orderStuckPriority,
  overdueDebtPriority,
  paymentDueSoonPriority,
  stockPriority,
} from "../src/server/automations/priority.ts";

test("§6 / §8 / §9 : stock faible → MEDIUM, rupture → HIGH", () => {
  assert.equal(stockPriority(4), "MEDIUM");
  assert.equal(stockPriority(0), "HIGH");
  assert.equal(stockPriority(-2), "HIGH");
});

test("§6 / §10 : créance en retard — la priorité monte avec l'âge et le montant", () => {
  assert.equal(overdueDebtPriority(3, 5_000), "LOW");
  assert.equal(overdueDebtPriority(31, 5_000), "MEDIUM");
  assert.equal(overdueDebtPriority(65, 5_000), "HIGH");
  assert.equal(overdueDebtPriority(95, 20_000), "HIGH");
  assert.equal(overdueDebtPriority(95, 800_000), "CRITICAL");
  // Gros montant même sans grand retard → HIGH.
  assert.equal(overdueDebtPriority(10, 200_000), "HIGH");
});

test("§11 : paiement bientôt dû → LOW, gros montant → MEDIUM", () => {
  assert.equal(paymentDueSoonPriority(20_000), "LOW");
  assert.equal(paymentDueSoonPriority(150_000), "MEDIUM");
});

test("§12 : client inactif — priorité croissante avec la durée", () => {
  assert.equal(inactiveCustomerPriority(60), "LOW");
  assert.equal(inactiveCustomerPriority(90), "MEDIUM");
  assert.equal(inactiveCustomerPriority(130), "HIGH");
});

test("§14 / §15 : commandes en attente / bloquées", () => {
  assert.equal(orderPendingPriority(3), "MEDIUM");
  assert.equal(orderPendingPriority(30), "HIGH");
  assert.equal(orderStuckPriority(50), "HIGH");
  assert.equal(orderStuckPriority(120), "CRITICAL");
});

test("maxPriority garde la plus forte", () => {
  assert.equal(maxPriority("LOW", "HIGH"), "HIGH");
  assert.equal(maxPriority("CRITICAL", "MEDIUM"), "CRITICAL");
  assert.equal(maxPriority("LOW", "LOW"), "LOW");
});
