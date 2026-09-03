import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Test d'INTÉGRATION isolation multi-tenant (§49). Critère : 0 fuite entre deux
 * organisations A et B. Bloquant pour le pilote.
 *
 *   DATABASE_URL="postgresql://…/djeli_test" RUN_DB_TESTS=1 npm test
 *
 * Vérifie :
 *  - `requireOrganizationAccess` : un membre de A n'accède pas à B ; un membre
 *    SUSPENDED est refusé sur sa propre org ;
 *  - `createOrder` / `recordPayment` : un id de client / commande d'une autre org
 *    est traité comme introuvable (jamais d'action cross-tenant) ;
 *  - les requêtes de liste scoping par `organizationId` ne renvoient jamais les
 *    lignes de l'autre tenant.
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";
const DB_URL = process.env.DATABASE_URL ?? "";
const ENABLED = RUN && /(_test|_shadow|localhost|127\.0\.0\.1)/.test(DB_URL);
const suiteOpts = ENABLED
  ? {}
  : { skip: !RUN ? "RUN_DB_TESTS non défini" : "DATABASE_URL hors base de test" };

type Deps = {
  prisma: import("@prisma/client").PrismaClient;
  requireOrganizationAccess: typeof import("../src/server/tenant/context.ts")["requireOrganizationAccess"];
  createOrder: typeof import("../src/server/orders/order-service.ts")["createOrder"];
  recordPayment: typeof import("../src/server/finance/payment-service.ts")["recordPayment"];
};
let d: Deps;

const TAG = `${Date.now()}`;
const A = { user: `it-t-uA-${TAG}`, org: `it-t-oA-${TAG}`, cust: "", order: "", product: "" };
const B = { user: `it-t-uB-${TAG}`, org: `it-t-oB-${TAG}`, cust: "", order: "", product: "" };
const SUSPENDED_USER = `it-t-susp-${TAG}`;

async function seed(o: typeof A) {
  await d.prisma.user.create({
    data: { id: o.user, email: `${o.user}@test.local`, firstName: "T", lastName: "Est" },
  });
  await d.prisma.organization.create({
    data: {
      id: o.org,
      name: `Org ${o.org}`,
      slug: o.org,
      currency: "XOF",
      ownerUserId: o.user,
      members: { create: { userId: o.user, role: "OWNER", status: "ACTIVE" } },
    },
  });
  const c = await d.prisma.customer.create({
    data: { organizationId: o.org, displayName: `Client ${o.org}` },
  });
  o.cust = c.id;
  const p = await d.prisma.product.create({
    data: { organizationId: o.org, sku: `SKU-${o.org}`, name: "Produit", salePrice: 1000, status: "ACTIVE" },
  });
  o.product = p.id;
  const ord = await d.prisma.order.create({
    data: {
      organizationId: o.org,
      customerId: c.id,
      orderNumber: 1,
      reference: `T-${o.org}-1`,
      currency: "XOF",
      status: "DELIVERED",
      totalAmount: 5000,
      subtotal: 5000,
      deliveredAt: new Date(),
    },
  });
  o.order = ord.id;
}

before(async () => {
  if (!ENABLED) return;
  const [{ prisma }, tenant, orders, payments] = await Promise.all([
    import("../src/server/db/client.ts"),
    import("../src/server/tenant/context.ts"),
    import("../src/server/orders/order-service.ts"),
    import("../src/server/finance/payment-service.ts"),
  ]);
  d = {
    prisma,
    requireOrganizationAccess: tenant.requireOrganizationAccess,
    createOrder: orders.createOrder,
    recordPayment: payments.recordPayment,
  };
  await seed(A);
  await seed(B);
  // Un membre SUSPENDED dans l'org A.
  await d.prisma.user.create({
    data: { id: SUSPENDED_USER, email: `${SUSPENDED_USER}@test.local`, firstName: "S", lastName: "U" },
  });
  await d.prisma.organizationMember.create({
    data: { organizationId: A.org, userId: SUSPENDED_USER, role: "SALES", status: "SUSPENDED" },
  });
});

after(async () => {
  if (!ENABLED || !d?.prisma) return;
  for (const oid of [A.org, B.org]) {
    await d.prisma.organization.delete({ where: { id: oid } }).catch(() => {});
  }
  for (const uid of [A.user, B.user, SUSPENDED_USER]) {
    await d.prisma.user.delete({ where: { id: uid } }).catch(() => {});
  }
  await d.prisma.$disconnect();
});

test("requireOrganizationAccess : membre de A accepté sur A, refusé sur B", suiteOpts, async () => {
  const ctx = await d.requireOrganizationAccess(A.user, A.org);
  assert.equal(ctx.organization.id, A.org);
  assert.equal(ctx.role, "OWNER");

  await assert.rejects(
    () => d.requireOrganizationAccess(A.user, B.org),
    /pas membre de cette entreprise/i,
  );
  await assert.rejects(
    () => d.requireOrganizationAccess(B.user, A.org),
    /pas membre de cette entreprise/i,
  );
});

test("requireOrganizationAccess : membre SUSPENDED refusé sur sa propre org", suiteOpts, async () => {
  await assert.rejects(() => d.requireOrganizationAccess(SUSPENDED_USER, A.org));
});

test("createOrder de l'org A avec un client de l'org B → introuvable (pas d'action cross-tenant)", suiteOpts, async () => {
  await assert.rejects(
    () =>
      d.createOrder({
        organizationId: A.org,
        actorUserId: A.user,
        customerId: B.cust, // client de B
        lines: [{ productId: A.product, quantity: 1 }],
        source: "MANUAL",
      }),
    /Client introuvable dans cette entreprise/i,
  );
  // rien créé côté A
  assert.equal(await d.prisma.order.count({ where: { organizationId: A.org } }), 1);
});

test("recordPayment de l'org A sur une commande de l'org B → introuvable", suiteOpts, async () => {
  await assert.rejects(
    () =>
      d.recordPayment({
        organizationId: A.org,
        actorUserId: A.user,
        customerId: A.cust,
        orderId: B.order, // commande de B
        amount: 100,
        method: "CASH",
      }),
    /Commande introuvable dans cette entreprise/i,
  );
});

test("listes scoping par organizationId : aucune ligne de l'autre tenant", suiteOpts, async () => {
  for (const [self, other] of [[A, B], [B, A]] as const) {
    const custs = await d.prisma.customer.findMany({ where: { organizationId: self.org }, select: { id: true } });
    assert.ok(custs.every((c) => c.id !== other.cust));
    const ords = await d.prisma.order.findMany({ where: { organizationId: self.org }, select: { id: true } });
    assert.ok(ords.every((o) => o.id !== other.order));
    const prods = await d.prisma.product.findMany({ where: { organizationId: self.org }, select: { id: true } });
    assert.ok(prods.every((p) => p.id !== other.product));
  }
});
