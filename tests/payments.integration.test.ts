import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests d'INTÉGRATION paiements / créances (§8, §34, §36, §49-§52).
 *
 *   DATABASE_URL="postgresql://…/djeli_test" RUN_DB_TESTS=1 npm test
 *
 * Couvre : paiement partiel → solde dérivé ; surpaiement REFUSÉ ; concurrence
 * (deux encaissements simultanés ne peuvent pas dépasser le total).
 * Garde-fou : refuse de tourner si DATABASE_URL ne cible pas une base de test.
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";
const DB_URL = process.env.DATABASE_URL ?? "";
const DB_LOOKS_LIKE_TEST = /(_test|_shadow|localhost|127\.0\.0\.1)/.test(DB_URL);
const ENABLED = RUN && DB_LOOKS_LIKE_TEST;

const suiteOpts = ENABLED
  ? {}
  : {
      skip: !RUN
        ? "RUN_DB_TESTS non défini"
        : "DATABASE_URL ne cible pas une base de test (sécurité)",
    };

type Deps = {
  prisma: import("@prisma/client").PrismaClient;
  recordPayment: typeof import("../src/server/finance/payment-service.ts")["recordPayment"];
};
let d: Deps;

const TAG = `it-pay-${Date.now()}`;
const ids = { user: `${TAG}-u`, org: `${TAG}-o`, customer: `${TAG}-c` };
let orderSeq = 0;

async function makeOrder(total: number): Promise<string> {
  orderSeq += 1;
  const o = await d.prisma.order.create({
    data: {
      organizationId: ids.org,
      customerId: ids.customer,
      orderNumber: orderSeq,
      reference: `${TAG}-CMD-${orderSeq}`,
      currency: "XOF",
      subtotal: total,
      totalAmount: total,
      status: "NEW",
    },
  });
  return o.id;
}

before(async () => {
  if (!ENABLED) return;
  const [{ prisma }, svc] = await Promise.all([
    import("../src/server/db/client.ts"),
    import("../src/server/finance/payment-service.ts"),
  ]);
  d = { prisma, recordPayment: svc.recordPayment };

  await d.prisma.user.create({
    data: { id: ids.user, email: `${TAG}@test.local`, firstName: "T", lastName: "Est" },
  });
  await d.prisma.organization.create({
    data: {
      id: ids.org,
      name: "IT Pay Org",
      slug: TAG,
      currency: "XOF",
      ownerUserId: ids.user,
      members: { create: { userId: ids.user, role: "OWNER", status: "ACTIVE" } },
    },
  });
  await d.prisma.customer.create({
    data: { id: ids.customer, organizationId: ids.org, displayName: "Client Test" },
  });
});

after(async () => {
  if (!ENABLED || !d?.prisma) return;
  await d.prisma.auditLog.deleteMany({ where: { actorUserId: ids.user } }).catch(() => {});
  await d.prisma.organization.delete({ where: { id: ids.org } }).catch(() => {});
  await d.prisma.user.delete({ where: { id: ids.user } }).catch(() => {});
  await d.prisma.$disconnect();
});

test("paiement partiel → amountPaid et solde dérivés", suiteOpts, async () => {
  const orderId = await makeOrder(10_000);
  const res = await d.recordPayment({
    organizationId: ids.org,
    actorUserId: ids.user,
    customerId: ids.customer,
    orderId,
    amount: 4_000,
    method: "CASH",
  });
  assert.equal(res.balanceDue, 6_000);

  const order = await d.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(order.amountPaid, 4_000);
  assert.equal(order.paymentStatus, "PARTIALLY_PAID");
});

test("surpaiement REFUSÉ (§8) — aucun paiement créé, commande inchangée", suiteOpts, async () => {
  const orderId = await makeOrder(10_000);
  await d.recordPayment({
    organizationId: ids.org,
    actorUserId: ids.user,
    customerId: ids.customer,
    orderId,
    amount: 4_000,
    method: "CASH",
  });

  await assert.rejects(
    () =>
      d.recordPayment({
        organizationId: ids.org,
        actorUserId: ids.user,
        customerId: ids.customer,
        orderId,
        amount: 7_000, // 4 000 déjà payés + 7 000 > 10 000
        method: "CASH",
      }),
    /solde restant/i,
  );

  const order = await d.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(order.amountPaid, 4_000, "le paiement refusé ne doit pas être compté");
  const count = await d.prisma.payment.count({ where: { orderId, status: "CONFIRMED" } });
  assert.equal(count, 1);
});

test(
  "concurrence : 2× recordPayment(6 000) sur un total de 10 000 → 1 seul aboutit, amountPaid ≤ total",
  suiteOpts,
  async () => {
    const orderId = await makeOrder(10_000);
    const pay = () =>
      d.recordPayment({
        organizationId: ids.org,
        actorUserId: ids.user,
        customerId: ids.customer,
        orderId,
        amount: 6_000,
        method: "CASH",
      });

    const results = await Promise.allSettled([pay(), pay()]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);

    const order = await d.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    assert.equal(order.amountPaid, 6_000, "jamais 12 000 : le verrou FOR UPDATE sérialise");
    const confirmed = await d.prisma.payment.count({
      where: { orderId, status: "CONFIRMED" },
    });
    assert.equal(confirmed, 1);
  },
);
