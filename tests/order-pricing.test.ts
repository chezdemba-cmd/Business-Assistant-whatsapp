import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeOrderTotals,
  lineSubtotal,
  OrderPricingError,
} from "../src/server/orders/pricing.ts";
import { formatOrderReference } from "../src/server/orders/reference.ts";

test("total = sous-total - remise + livraison", () => {
  const t = computeOrderTotals({
    lines: [
      { unitPrice: 31500, quantity: 6 },
      { unitPrice: 9800, quantity: 10 },
    ],
    discountAmount: 5000,
    deliveryFee: 2000,
  });
  assert.equal(t.subtotal, 31500 * 6 + 9800 * 10);
  assert.equal(t.discountAmount, 5000);
  assert.equal(t.deliveryFee, 2000);
  assert.equal(t.totalAmount, t.subtotal - 5000 + 2000);
});

test("remise bornée : 0 <= remise <= sous-total", () => {
  assert.throws(
    () => computeOrderTotals({ lines: [{ unitPrice: 100, quantity: 1 }], discountAmount: -1 }),
    OrderPricingError,
  );
  assert.throws(
    () => computeOrderTotals({ lines: [{ unitPrice: 100, quantity: 2 }], discountAmount: 300 }),
    OrderPricingError,
  );
  // remise = sous-total : OK, total = livraison
  const t = computeOrderTotals({
    lines: [{ unitPrice: 100, quantity: 2 }],
    discountAmount: 200,
    deliveryFee: 50,
  });
  assert.equal(t.totalAmount, 50);
});

test("refus : aucune ligne, quantité ou prix invalides", () => {
  assert.throws(() => computeOrderTotals({ lines: [] }), OrderPricingError);
  assert.throws(
    () => computeOrderTotals({ lines: [{ unitPrice: 100, quantity: 0 }] }),
    OrderPricingError,
  );
  assert.throws(
    () => computeOrderTotals({ lines: [{ unitPrice: -1, quantity: 1 }] }),
    OrderPricingError,
  );
});

test("lineSubtotal — entiers", () => {
  assert.equal(lineSubtotal({ unitPrice: 31500, quantity: 6 }), 189000);
});

test("référence de commande formatée", () => {
  assert.equal(formatOrderReference(1), "CMD-0001");
  assert.equal(formatOrderReference(2841), "CMD-2841");
  assert.equal(formatOrderReference(12345), "CMD-12345");
});
