import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agingBucketFor,
  assertWithinBalance,
  balanceDue,
  daysOverdue,
  derivePaymentStatus,
  isOrderOverdue,
  isRecoverableDebt,
  OverpaymentError,
  sumConfirmedPayments,
} from "../src/server/finance/payment-rules.ts";

const day = 24 * 60 * 60 * 1000;

// ── §37 Paiement partiel ────────────────────────────────────────────

test("§37 — 189000 : paiement 100000 → PARTIALLY_PAID, puis 89000 → PAID", () => {
  assert.equal(derivePaymentStatus(189000, 0), "UNPAID");
  assert.equal(derivePaymentStatus(189000, 100000), "PARTIALLY_PAID");
  assert.equal(derivePaymentStatus(189000, 189000), "PAID");
  assert.equal(balanceDue(189000, 100000), 89000);
  assert.equal(balanceDue(189000, 189000), 0);
});

test("mode crédit : 0 encaissé → CREDIT au lieu de UNPAID", () => {
  assert.equal(derivePaymentStatus(189000, 0, { creditMode: true }), "CREDIT");
  assert.equal(derivePaymentStatus(189000, 1, { creditMode: true }), "PARTIALLY_PAID");
});

test("solde jamais négatif ; paiement ≥ total → PAID", () => {
  assert.equal(balanceDue(100000, 120000), 0);
  assert.equal(derivePaymentStatus(100000, 120000), "PAID");
});

// ── §38 Surpaiement interdit ────────────────────────────────────────

test("§38 — solde 89000, tentative 90000 → OverpaymentError", () => {
  assert.throws(
    () =>
      assertWithinBalance({
        totalAmount: 189000,
        amountPaidBefore: 100000,
        incomingAmount: 90000,
      }),
    OverpaymentError,
  );
  // exactement le solde : accepté
  assert.doesNotThrow(() =>
    assertWithinBalance({
      totalAmount: 189000,
      amountPaidBefore: 100000,
      incomingAmount: 89000,
    }),
  );
});

test("montant nul ou négatif refusé", () => {
  assert.throws(
    () =>
      assertWithinBalance({
        totalAmount: 1000,
        amountPaidBefore: 0,
        incomingAmount: 0,
      }),
    OverpaymentError,
  );
});

// ── §39 Annulation ─────────────────────────────────────────────────

test("§39 — sumConfirmedPayments ignore PENDING et CANCELLED", () => {
  const payments = [
    { amount: 100000, status: "CONFIRMED" as const },
    { amount: 50000, status: "CANCELLED" as const },
    { amount: 20000, status: "PENDING" as const },
  ];
  assert.equal(sumConfirmedPayments(payments), 100000);
  // Après annulation du seul paiement CONFIRMED → 0 → statut re-dérivé
  assert.equal(
    derivePaymentStatus(189000, sumConfirmedPayments([
      { amount: 100000, status: "CANCELLED" as const },
    ])),
    "UNPAID",
  );
});

// ── §40 / §41 Créance & retard ─────────────────────────────────────

test("§40 — LIVRÉE, solde 89000, échéance hier → recouvrable + en retard", () => {
  const dueDate = new Date(Date.now() - day);
  assert.equal(isRecoverableDebt({ status: "DELIVERED", balanceDue: 89000 }), true);
  assert.equal(
    isOrderOverdue({ status: "DELIVERED", balanceDue: 89000, dueDate }),
    true,
  );
});

test("§41 — commande NON livrée avec solde → jamais 'en retard'", () => {
  const dueDate = new Date(Date.now() - 10 * day);
  assert.equal(
    isOrderOverdue({ status: "CONFIRMED", balanceDue: 89000, dueDate }),
    false,
  );
  assert.equal(isRecoverableDebt({ status: "CONFIRMED", balanceDue: 89000 }), false);
});

test("échéance nulle → jamais 'en retard' automatiquement", () => {
  assert.equal(
    isOrderOverdue({ status: "DELIVERED", balanceDue: 5000, dueDate: null }),
    false,
  );
});

test("solde nul → pas en retard même échéance dépassée", () => {
  assert.equal(
    isOrderOverdue({
      status: "DELIVERED",
      balanceDue: 0,
      dueDate: new Date(Date.now() - day),
    }),
    false,
  );
});

// ── §14 Tranches d'ancienneté ──────────────────────────────────────

test("§14 — tranches d'ancienneté (À échoir, 1–7, 8–30, 31–60, 61–90, 90+)", () => {
  const now = new Date("2026-06-30T12:00:00Z");
  const at = (d: number) => new Date(now.getTime() - d * day);
  assert.equal(agingBucketFor(null, now), "NOT_DUE");
  assert.equal(agingBucketFor(at(-3), now), "NOT_DUE"); // échéance future
  assert.equal(agingBucketFor(at(1), now), "D1_7");
  assert.equal(agingBucketFor(at(7), now), "D1_7");
  assert.equal(agingBucketFor(at(8), now), "D8_30");
  assert.equal(agingBucketFor(at(30), now), "D8_30");
  assert.equal(agingBucketFor(at(31), now), "D31_60");
  assert.equal(agingBucketFor(at(60), now), "D31_60");
  assert.equal(agingBucketFor(at(61), now), "D61_90");
  assert.equal(agingBucketFor(at(90), now), "D61_90");
  assert.equal(agingBucketFor(at(91), now), "D90_PLUS");
  assert.equal(agingBucketFor(at(400), now), "D90_PLUS");
});

test("daysOverdue : négatif si futur, positif si dépassé", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  assert.equal(daysOverdue(new Date("2026-06-20T00:00:00Z"), now), 10);
  assert.equal(daysOverdue(new Date("2026-07-05T00:00:00Z"), now), -5);
});
