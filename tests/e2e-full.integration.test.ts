import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Test d'INTÉGRATION e2e « chemin nominal » (§49-§52) : cycle de vie complet
 * d'une commande à travers la couche service —
 *   création (réserve le stock) → CONFIRMED → PREPARING → OUT_FOR_DELIVERY →
 *   DELIVERED (mouvement SALE, réservation FULFILLED, stock physique décrémenté)
 *   → encaissement total (solde = 0).
 *
 *   DATABASE_URL="postgresql://…/djeli_test" RUN_DB_TESTS=1 npm test
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";
const DB_URL = process.env.DATABASE_URL ?? "";
const ENABLED = RUN && /(_test|_shadow|localhost|127\.0\.0\.1)/.test(DB_URL);
const suiteOpts = ENABLED
  ? {}
  : { skip: !RUN ? "RUN_DB_TESTS non défini" : "DATABASE_URL hors base de test" };

type Deps = {
  prisma: import("@prisma/client").PrismaClient;
  createOrder: typeof import("../src/server/orders/order-service.ts")["createOrder"];
  transitionOrder: typeof import("../src/server/orders/order-service.ts")["transitionOrder"];
  recordPayment: typeof import("../src/server/finance/payment-service.ts")["recordPayment"];
};
let d: Deps;

const TAG = `${Date.now()}`;
const ids = { user: `it-e2e-u-${TAG}`, org: `it-e2e-o-${TAG}`, product: "", customer: "" };

before(async () => {
  if (!ENABLED) return;
  const [{ prisma }, orders, payments] = await Promise.all([
    import("../src/server/db/client.ts"),
    import("../src/server/orders/order-service.ts"),
    import("../src/server/finance/payment-service.ts"),
  ]);
  d = {
    prisma,
    createOrder: orders.createOrder,
    transitionOrder: orders.transitionOrder,
    recordPayment: payments.recordPayment,
  };

  await d.prisma.user.create({
    data: { id: ids.user, email: `${ids.user}@test.local`, firstName: "T", lastName: "Est" },
  });
  await d.prisma.organization.create({
    data: {
      id: ids.org,
      name: "E2E Org",
      slug: ids.org,
      currency: "XOF",
      ownerUserId: ids.user,
      members: { create: { userId: ids.user, role: "OWNER", status: "ACTIVE" } },
    },
  });
  const p = await d.prisma.product.create({
    data: { organizationId: ids.org, sku: `E2E-${TAG}`, name: "Sac 25 kg", salePrice: 5_000, status: "ACTIVE" },
  });
  ids.product = p.id;
  await d.prisma.stockMovement.create({
    data: { organizationId: ids.org, productId: p.id, type: "PURCHASE", quantity: 10, reference: "E2E-INIT" },
  });
  const c = await d.prisma.customer.create({
    data: { organizationId: ids.org, displayName: "Client E2E" },
  });
  ids.customer = c.id;
});

after(async () => {
  if (!ENABLED || !d?.prisma) return;
  await d.prisma.auditLog.deleteMany({ where: { actorUserId: ids.user } }).catch(() => {});
  await d.prisma.organization.delete({ where: { id: ids.org } }).catch(() => {});
  await d.prisma.user.delete({ where: { id: ids.user } }).catch(() => {});
  await d.prisma.$disconnect();
});

test("cycle complet commande → livraison → encaissement", suiteOpts, async () => {
  // 1. Création : réserve 3 unités, stock physique inchangé (10).
  const { orderId } = await d.createOrder({
    organizationId: ids.org,
    actorUserId: ids.user,
    customerId: ids.customer,
    lines: [{ productId: ids.product, quantity: 3 }],
    source: "MANUAL",
  });

  let physical = await d.prisma.stockMovement.aggregate({
    where: { productId: ids.product, type: "PURCHASE" },
    _sum: { quantity: true },
  });
  assert.equal(physical._sum.quantity, 10);
  let reserved = await d.prisma.stockReservation.aggregate({
    where: { sourceId: orderId, status: "ACTIVE" },
    _sum: { quantity: true },
  });
  assert.equal(reserved._sum.quantity, 3);

  // 2. Progression de statut jusqu'à livraison.
  for (const to of ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as const) {
    await d.transitionOrder({
      organizationId: ids.org,
      actorUserId: ids.user,
      orderId,
      to,
      source: "MANUAL",
    });
  }

  const order = await d.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(order.status, "DELIVERED");
  assert.ok(order.deliveredAt);

  // 3. Livraison : mouvement SALE de 3, réservation FULFILLED, physique 10 → 7.
  const sale = await d.prisma.stockMovement.aggregate({
    where: { productId: ids.product, type: "SALE" },
    _sum: { quantity: true },
  });
  assert.equal(sale._sum.quantity, 3);
  const fulfilled = await d.prisma.stockReservation.count({
    where: { sourceId: orderId, status: "FULFILLED" },
  });
  assert.equal(fulfilled, 1);
  assert.equal(
    await d.prisma.stockReservation.count({ where: { sourceId: orderId, status: "ACTIVE" } }),
    0,
  );

  // 4. Encaissement total → solde 0, commande PAID.
  const pay = await d.recordPayment({
    organizationId: ids.org,
    actorUserId: ids.user,
    customerId: ids.customer,
    orderId,
    amount: order.totalAmount,
    method: "CASH",
  });
  assert.equal(pay.balanceDue, 0);
  const paid = await d.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(paid.amountPaid, order.totalAmount);
  assert.equal(paid.paymentStatus, "PAID");
});
