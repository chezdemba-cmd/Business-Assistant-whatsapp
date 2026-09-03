import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests d'INTÉGRATION commandes / réservations / concurrence (§49-§52).
 *
 * Nécessite une VRAIE base PostgreSQL, JAMAIS staging/prod :
 *   DATABASE_URL="postgresql://…/djeli_test" RUN_DB_TESTS=1 npm test
 *
 * Garde-fou : le fichier refuse de tourner si DATABASE_URL ne cible pas
 * visiblement une base de test.
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

// Imports différés : ne charger Prisma/services QUE si la suite est active
// (évite d'ouvrir une connexion quand on ne fait que `skip`).
type Deps = {
  prisma: import("@prisma/client").PrismaClient;
  createOrder: typeof import("../src/server/orders/order-service.ts")["createOrder"];
};
let d: Deps;

const TAG = `it-orders-${Date.now()}`;
const ids = {
  user: `${TAG}-user`,
  org: `${TAG}-org`,
  product: `${TAG}-product`,
  customer: `${TAG}-customer`,
};

before(async () => {
  if (!ENABLED) return;
  const [{ prisma }, orderSvc] = await Promise.all([
    import("../src/server/db/client.ts"),
    import("../src/server/orders/order-service.ts"),
  ]);
  d = { prisma, createOrder: orderSvc.createOrder };

  await d.prisma.user.create({
    data: { id: ids.user, email: `${TAG}@test.local`, firstName: "T", lastName: "Est" },
  });
  await d.prisma.organization.create({
    data: {
      id: ids.org,
      name: "IT Orders Org",
      slug: TAG,
      currency: "XOF",
      ownerUserId: ids.user,
      members: { create: { userId: ids.user, role: "OWNER", status: "ACTIVE" } },
    },
  });
  await d.prisma.product.create({
    data: {
      id: ids.product,
      organizationId: ids.org,
      sku: "IT-SKU-1",
      name: "Sac test 50 kg",
      salePrice: 10_000,
      status: "ACTIVE",
    },
  });
  // Stock physique = 6 via un mouvement d'entrée.
  await d.prisma.stockMovement.create({
    data: {
      organizationId: ids.org,
      productId: ids.product,
      type: "PURCHASE",
      quantity: 6,
      reference: "IT-INIT",
    },
  });
  await d.prisma.customer.create({
    data: { id: ids.customer, organizationId: ids.org, displayName: "Client Test" },
  });
});

after(async () => {
  if (!ENABLED || !d?.prisma) return;
  // Cascade depuis Organization couvre products / orders / items / réservations /
  // mouvements / counter / historique / activités. AuditLog = SetNull → nettoyage.
  await d.prisma.auditLog.deleteMany({ where: { actorUserId: ids.user } }).catch(() => {});
  await d.prisma.organization.delete({ where: { id: ids.org } }).catch(() => {});
  await d.prisma.user.delete({ where: { id: ids.user } }).catch(() => {});
  await d.prisma.$disconnect();
});

test("createOrder : stock 6, commande de 4 → réservation ACTIVE=4, physique inchangé", suiteOpts, async () => {
  const { orderId } = await d.createOrder({
    organizationId: ids.org,
    actorUserId: ids.user,
    customerId: ids.customer,
    lines: [{ productId: ids.product, quantity: 4 }],
    source: "MANUAL",
  });

  const reservations = await d.prisma.stockReservation.findMany({
    where: { sourceType: "ORDER", sourceId: orderId },
  });
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0]!.status, "ACTIVE");
  assert.equal(reservations[0]!.quantity, 4);

  const physical = await d.prisma.stockMovement.aggregate({
    where: { productId: ids.product, type: "PURCHASE" },
    _sum: { quantity: true },
  });
  assert.equal(physical._sum.quantity, 6); // aucune sortie physique avant livraison

  // Remise à zéro pour le test de concurrence : on annule cette réservation.
  await d.prisma.stockReservation.updateMany({
    where: { sourceId: orderId },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
  await d.prisma.order.delete({ where: { id: orderId } });
});

test(
  "concurrence : 2× createOrder(6) sur disponible=6 → 1 succès, 1 échec, réservé final = 6 (jamais 12)",
  suiteOpts,
  async () => {
    const attempt = () =>
      d.createOrder({
        organizationId: ids.org,
        actorUserId: ids.user,
        customerId: ids.customer,
        lines: [{ productId: ids.product, quantity: 6 }],
        source: "MANUAL",
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "exactement une commande doit aboutir");
    assert.equal(rejected.length, 1, "exactement une commande doit échouer");
    assert.match(
      String((rejected[0] as PromiseRejectedResult).reason?.message ?? ""),
      /[Ss]tock insuffisant/,
    );

    const activeReserved = await d.prisma.stockReservation.aggregate({
      where: { productId: ids.product, status: "ACTIVE" },
      _sum: { quantity: true },
    });
    assert.equal(activeReserved._sum.quantity, 6, "réservé actif = 6, jamais 12 (pas de survente)");

    const orders = await d.prisma.order.count({ where: { organizationId: ids.org } });
    assert.equal(orders, 1);
  },
);
