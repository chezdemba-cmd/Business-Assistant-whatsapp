/**
 * Seed STAGING / DÉMO — jamais en production.
 *
 *   npm run demo:seed      # (re)crée les données démo, idempotent
 *   npm run demo:reset      # supprime l'org démo puis re-seed (voir scripts/demo-reset.ts)
 *
 * Organisation : « FEREDRON DEMO COMMERCE » (slug feredron-demo-commerce), isDemo=true.
 * Aucune donnée réelle. Toutes les valeurs (prix FCFA, noms, téléphones) sont
 * FICTIVES et ne représentent pas des prix officiels.
 *
 * Comptes de test : owner@ / admin@ / manager@ / sales@ / employee@demo.djeli.test
 * Mots de passe : variables DEMO_*_PASSWORD (fallback documenté sinon).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { derivePaymentStatus } from "../src/server/finance/payment-rules.ts";

const prisma = new PrismaClient();

export const DEMO_ORG_SLUG = "feredron-demo-commerce";
export const DEMO_ORG_NAME = "FEREDRON DEMO COMMERCE";

const FALLBACK_PASSWORD = "demo-djeli-staging";

function guardEnv(): void {
  const appEnv = process.env.APP_ENV ?? "development";
  if (appEnv === "production" || process.env.NODE_ENV === "production") {
    console.error("✗ Seed DÉMO refusé : APP_ENV/NODE_ENV = production.");
    process.exit(1);
  }
}

const PEOPLE = [
  { key: "owner", firstName: "Salif", lastName: "Konaté", email: "owner@demo.djeli.test", phone: "+22390000001", role: "OWNER" as const, envPw: "DEMO_OWNER_PASSWORD", superAdmin: true },
  { key: "admin", firstName: "Nana", lastName: "Diarra", email: "admin@demo.djeli.test", phone: "+22390000002", role: "ADMIN" as const, envPw: "DEMO_ADMIN_PASSWORD", superAdmin: false },
  { key: "manager", firstName: "Bakary", lastName: "Sangaré", email: "manager@demo.djeli.test", phone: "+22390000003", role: "MANAGER" as const, envPw: "DEMO_MANAGER_PASSWORD", superAdmin: false },
  { key: "sales", firstName: "Awa", lastName: "Touré", email: "sales@demo.djeli.test", phone: "+22390000004", role: "SALES" as const, envPw: "DEMO_SALES_PASSWORD", superAdmin: false },
  { key: "employee", firstName: "Modibo", lastName: "Fofana", email: "employee@demo.djeli.test", phone: "+22390000005", role: "EMPLOYEE" as const, envPw: "DEMO_EMPLOYEE_PASSWORD", superAdmin: false },
];

const CATEGORIES = [
  "Sucre & farine", "Riz", "Huile", "Lait & boissons",
  "Pâtes", "Hygiène", "Épicerie", "Conserves",
];

type Move = { type: "SALE" | "PURCHASE" | "ADJUSTMENT_OUT" | "ADJUSTMENT_IN"; qty: number; reason: string };
type Prod = {
  sku: string; name: string; category: string; unit: "SAC" | "CARTON" | "BIDON" | "UNIT" | "PAQUET";
  salePrice: number; purchasePrice: number; alertThreshold: number; supplier: string;
  initial: number; moves?: Move[];
};

const PRODUCTS: Prod[] = [
  // ── stock normal ──
  { sku: "SUC-050", name: "Sucre en poudre — sac 50 kg", category: "Sucre & farine", unit: "SAC", salePrice: 28500, purchasePrice: 24000, alertThreshold: 8, supplier: "Sukala (démo)", initial: 60 },
  { sku: "FAR-025", name: "Farine de blé — sac 25 kg", category: "Sucre & farine", unit: "SAC", salePrice: 14200, purchasePrice: 11800, alertThreshold: 10, supplier: "Grands Moulins (démo)", initial: 45 },
  { sku: "RIZ-050", name: "Riz brisé importé — sac 50 kg", category: "Riz", unit: "SAC", salePrice: 22000, purchasePrice: 18500, alertThreshold: 12, supplier: "Import Sahel (démo)", initial: 80, moves: [{ type: "SALE", qty: 20, reason: "Ventes de la semaine (démo)" }] },
  { sku: "RIZ-025", name: "Riz local Gambiaka — sac 25 kg", category: "Riz", unit: "SAC", salePrice: 13500, purchasePrice: 11000, alertThreshold: 10, supplier: "Coop Ségou (démo)", initial: 50 },
  { sku: "HUI-020", name: "Huile végétale — bidon 20 L", category: "Huile", unit: "BIDON", salePrice: 21500, purchasePrice: 18000, alertThreshold: 6, supplier: "Huilerie du Fleuve (démo)", initial: 40, moves: [{ type: "SALE", qty: 8, reason: "Ventes (démo)" }] },
  { sku: "HUI-005", name: "Huile végétale — bidon 5 L", category: "Huile", unit: "BIDON", salePrice: 6200, purchasePrice: 4900, alertThreshold: 15, supplier: "Huilerie du Fleuve (démo)", initial: 70 },
  { sku: "LAI-PWD", name: "Lait en poudre — carton 24×400 g", category: "Lait & boissons", unit: "CARTON", salePrice: 31200, purchasePrice: 27000, alertThreshold: 6, supplier: "Laiterie Import (démo)", initial: 35 },
  { sku: "JUS-100", name: "Jus de fruits — carton 12×1 L", category: "Lait & boissons", unit: "CARTON", salePrice: 9800, purchasePrice: 7600, alertThreshold: 10, supplier: "Boissons Bamako (démo)", initial: 55 },
  { sku: "EAU-150", name: "Eau minérale — pack 6×1,5 L", category: "Lait & boissons", unit: "PAQUET", salePrice: 2400, purchasePrice: 1700, alertThreshold: 30, supplier: "Source Kati (démo)", initial: 120 },
  { sku: "PAT-SPA", name: "Pâtes spaghetti — carton 20×500 g", category: "Pâtes", unit: "CARTON", salePrice: 8600, purchasePrice: 6800, alertThreshold: 12, supplier: "Pastificio (démo)", initial: 48 },
  { sku: "PAT-COQ", name: "Pâtes coquillettes — carton 20×500 g", category: "Pâtes", unit: "CARTON", salePrice: 8600, purchasePrice: 6800, alertThreshold: 12, supplier: "Pastificio (démo)", initial: 40 },
  { sku: "CON-TOM", name: "Concentré de tomate — carton 25×70 g", category: "Conserves", unit: "CARTON", salePrice: 7400, purchasePrice: 5600, alertThreshold: 15, supplier: "Conserverie (démo)", initial: 65 },
  { sku: "CON-SAR", name: "Sardines à l'huile — carton 50 boîtes", category: "Conserves", unit: "CARTON", salePrice: 12800, purchasePrice: 10200, alertThreshold: 8, supplier: "Conserverie (démo)", initial: 30 },
  { sku: "EPI-SEL", name: "Sel iodé — sac 25 kg", category: "Épicerie", unit: "SAC", salePrice: 4300, purchasePrice: 3100, alertThreshold: 10, supplier: "Salins (démo)", initial: 50 },
  { sku: "EPI-CUB", name: "Bouillon cube — carton 60 sachets", category: "Épicerie", unit: "CARTON", salePrice: 15600, purchasePrice: 12800, alertThreshold: 8, supplier: "Épices SA (démo)", initial: 38 },
  // ── stock faible (sous le seuil) ──
  { sku: "SAV-MRS", name: "Savon de Marseille — carton 40", category: "Hygiène", unit: "CARTON", salePrice: 12400, purchasePrice: 9800, alertThreshold: 10, supplier: "Savonnerie (démo)", initial: 30, moves: [{ type: "SALE", qty: 24, reason: "Grosse commande revendeur (démo)" }] },
  { sku: "SAV-LIQ", name: "Savon liquide — carton 12×1 L", category: "Hygiène", unit: "CARTON", salePrice: 9200, purchasePrice: 7000, alertThreshold: 12, supplier: "Savonnerie (démo)", initial: 20, moves: [{ type: "SALE", qty: 14, reason: "Ventes (démo)" }] },
  { sku: "SUC-025", name: "Sucre en poudre — sac 25 kg", category: "Sucre & farine", unit: "SAC", salePrice: 15200, purchasePrice: 12600, alertThreshold: 10, supplier: "Sukala (démo)", initial: 22, moves: [{ type: "SALE", qty: 16, reason: "Ventes (démo)" }] },
  // ── rupture ──
  { sku: "LAI-CND", name: "Lait concentré sucré — carton 48 boîtes", category: "Lait & boissons", unit: "CARTON", salePrice: 18400, purchasePrice: 15200, alertThreshold: 6, supplier: "Laiterie Import (démo)", initial: 18, moves: [{ type: "SALE", qty: 18, reason: "Épuisé — réassort attendu (démo)" }] },
  { sku: "HUI-001", name: "Huile végétale — bouteille 1 L", category: "Huile", unit: "UNIT", salePrice: 1350, purchasePrice: 1000, alertThreshold: 40, supplier: "Huilerie du Fleuve (démo)", initial: 60, moves: [{ type: "SALE", qty: 60, reason: "Rupture — commande fournisseur en cours (démo)" }] },
];

type CustSpec = {
  displayName: string; phone: string; type: "DETAILLANT" | "GROSSISTE" | "REVENDEUR" | "ENTREPRISE" | "PARTICULIER";
  area: string; assignTo?: "sales";
};
const CUSTOMERS: CustSpec[] = [
  { displayName: "Boutique Kéné", phone: "+22391000001", type: "DETAILLANT", area: "Badalabougou", assignTo: "sales" },
  { displayName: "Alimentation Sabali", phone: "+22391000002", type: "DETAILLANT", area: "Hamdallaye", assignTo: "sales" },
  { displayName: "Grossiste Faso Djigui", phone: "+22391000003", type: "GROSSISTE", area: "Sogoniko" },
  { displayName: "Restaurant Teriya", phone: "+22391000004", type: "ENTREPRISE", area: "Quinzambougou", assignTo: "sales" },
  { displayName: "Revente Mariko", phone: "+22391000005", type: "REVENDEUR", area: "Djicoroni" },
  { displayName: "Épicerie Nafama", phone: "+22391000006", type: "DETAILLANT", area: "Magnambougou" },
  { displayName: "Cantine Lafia", phone: "+22391000007", type: "ENTREPRISE", area: "Kalaban Coura" },
  { displayName: "Boutique Djoliba", phone: "+22391000008", type: "DETAILLANT", area: "Niamakoro", assignTo: "sales" },
  { displayName: "Grossiste Sinsibéré", phone: "+22391000009", type: "GROSSISTE", area: "Sébénikoro" },
  { displayName: "Revente Coulibaly Frères", phone: "+22391000010", type: "REVENDEUR", area: "Faladié" },
  { displayName: "Alimentation Baraka", phone: "+22391000011", type: "DETAILLANT", area: "Lafiabougou" },
  { displayName: "Restaurant Sukabe", phone: "+22391000012", type: "ENTREPRISE", area: "ACI 2000" },
  { displayName: "Boutique Yiriwa", phone: "+22391000013", type: "DETAILLANT", area: "Banconi", assignTo: "sales" },
  { displayName: "Grossiste Jamana", phone: "+22391000014", type: "GROSSISTE", area: "Sabalibougou" },
  { displayName: "Épicerie du Marché", phone: "+22391000015", type: "DETAILLANT", area: "Médine" },
  { displayName: "Revente Traoré", phone: "+22391000016", type: "REVENDEUR", area: "Torokorobougou" },
  { displayName: "Mme Diallo (particulier)", phone: "+22391000017", type: "PARTICULIER", area: "Hippodrome" },
  { displayName: "Boutique Terya Ba", phone: "+22391000018", type: "DETAILLANT", area: "Sikoro" },
];

type OrderSpec = {
  customer: string;
  lines: Array<{ sku: string; qty: number }>;
  status: "NEW" | "PENDING_CONFIRMATION" | "CONFIRMED" | "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
  ageDays?: number;      // décalage createdAt (négatif = passé)
  dueInDays?: number;    // échéance (négatif = en retard) pour les livrées à crédit
  payments?: number[];   // paiements CONFIRMED (livrées)
  staleHours?: number;   // force updatedAt en arrière (commande bloquée)
};

const ORDERS: OrderSpec[] = [
  // En cours (réservations actives → réduisent le disponible)
  { customer: "Boutique Kéné", lines: [{ sku: "RIZ-025", qty: 6 }, { sku: "SUC-050", qty: 2 }], status: "NEW", ageDays: -1 },
  { customer: "Épicerie Nafama", lines: [{ sku: "HUI-005", qty: 8 }], status: "PENDING_CONFIRMATION", ageDays: 0, staleHours: 6 },
  { customer: "Grossiste Faso Djigui", lines: [{ sku: "SUC-050", qty: 10 }, { sku: "FAR-025", qty: 8 }], status: "CONFIRMED", ageDays: -2 },
  { customer: "Restaurant Teriya", lines: [{ sku: "PAT-SPA", qty: 6 }, { sku: "CON-TOM", qty: 4 }], status: "PREPARING", ageDays: -4, staleHours: 72 },
  { customer: "Cantine Lafia", lines: [{ sku: "RIZ-050", qty: 4 }], status: "OUT_FOR_DELIVERY", ageDays: -1 },
  { customer: "Boutique Djoliba", lines: [{ sku: "JUS-100", qty: 5 }], status: "CANCELLED", ageDays: -6 },

  // Livrées — créances par tranche d'ancienneté
  { customer: "Alimentation Sabali", lines: [{ sku: "HUI-020", qty: 3 }], status: "DELIVERED", ageDays: -5, dueInDays: -3 },              // récente
  { customer: "Revente Mariko", lines: [{ sku: "SUC-050", qty: 4 }], status: "DELIVERED", ageDays: -40, dueInDays: -35 },                // > 30 j
  { customer: "Grossiste Sinsibéré", lines: [{ sku: "FAR-025", qty: 10 }], status: "DELIVERED", ageDays: -75, dueInDays: -68 },          // > 60 j
  { customer: "Revente Coulibaly Frères", lines: [{ sku: "RIZ-050", qty: 5 }], status: "DELIVERED", ageDays: -120, dueInDays: -110 },    // > 90 j
  { customer: "Boutique Yiriwa", lines: [{ sku: "LAI-PWD", qty: 3 }], status: "DELIVERED", ageDays: -25, dueInDays: -20, payments: [40000] }, // partielle
  { customer: "Épicerie du Marché", lines: [{ sku: "PAT-COQ", qty: 4 }, { sku: "EPI-CUB", qty: 2 }], status: "DELIVERED", ageDays: -8, payments: [65600] }, // soldée
  { customer: "Restaurant Sukabe", lines: [{ sku: "HUI-005", qty: 6 }], status: "DELIVERED", ageDays: -3, dueInDays: 2 },                // échéance proche

  // Client inactif : une seule commande livrée, il y a longtemps, rien depuis
  { customer: "Mme Diallo (particulier)", lines: [{ sku: "EAU-150", qty: 4 }], status: "DELIVERED", ageDays: -80, payments: [9600] },

  // Volume récent pour le résumé du jour
  { customer: "Boutique Terya Ba", lines: [{ sku: "SUC-025", qty: 2 }, { sku: "SAV-MRS", qty: 1 }], status: "DELIVERED", ageDays: 0, payments: [42800] },
  { customer: "Grossiste Jamana", lines: [{ sku: "RIZ-050", qty: 8 }], status: "DELIVERED", ageDays: 0, payments: [176000] },
];

async function main(): Promise<void> {
  guardEnv();
  const summary = await seedStaging();
  console.log("✓ Seed DÉMO terminé.");
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k.padEnd(14)}: ${v}`);
  const pwHint = process.env.DEMO_OWNER_PASSWORD ? "(variables DEMO_*_PASSWORD)" : `(fallback: ${FALLBACK_PASSWORD})`;
  console.log(`\n  Connexion   : owner@demo.djeli.test  ${pwHint}`);
  console.log(`  Autres      : admin@ / manager@ / sales@ / employee@demo.djeli.test`);
  console.log(`  Voir        : docs/TEST-ACCOUNTS.md · docs/TESTER-GUIDE.md`);
}

export async function seedStaging(): Promise<Record<string, number | string>> {
  guardEnv();

  // ── Comptes de test ──
  const users: Record<string, { id: string; email: string }> = {};
  for (const p of PEOPLE) {
    const pw = process.env[p.envPw] || FALLBACK_PASSWORD;
    const hash = await bcrypt.hash(pw, 12);
    const u = await prisma.user.upsert({
      where: { email: p.email },
      update: { firstName: p.firstName, lastName: p.lastName, passwordHash: hash, isSuperAdmin: p.superAdmin },
      create: {
        email: p.email, firstName: p.firstName, lastName: p.lastName,
        phone: p.phone, passwordHash: hash, isSuperAdmin: p.superAdmin,
      },
    });
    users[p.key] = { id: u.id, email: u.email };
  }
  const owner = users.owner!;
  const sales = users.sales!;

  // ── Organisation DÉMO ──
  const org = await prisma.organization.upsert({
    where: { slug: DEMO_ORG_SLUG },
    update: { name: DEMO_ORG_NAME, isDemo: true, isPilot: false },
    create: {
      name: DEMO_ORG_NAME, slug: DEMO_ORG_SLUG,
      countryCode: "ML", currency: "XOF", timezone: "Africa/Bamako",
      businessType: "WHOLESALE", status: "ACTIVE",
      isDemo: true, isPilot: false,
      ownerUserId: owner.id, onboardedAt: new Date(),
    },
  });

  for (const p of PEOPLE) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: users[p.key]!.id } },
      update: { role: p.role, status: "ACTIVE" },
      create: { organizationId: org.id, userId: users[p.key]!.id, role: p.role, status: "ACTIVE" },
    });
  }

  // ── Catégories ──
  const catId = new Map<string, string>();
  for (const name of CATEGORIES) {
    const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const c = await prisma.productCategory.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug } },
      update: { name },
      create: { organizationId: org.id, name, slug },
    });
    catId.set(name, c.id);
  }

  // ── Produits + mouvements de stock ──
  for (const spec of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: org.id, sku: spec.sku } },
      update: {
        name: spec.name, salePrice: spec.salePrice, purchasePrice: spec.purchasePrice,
        alertThreshold: spec.alertThreshold, supplierName: spec.supplier,
        categoryId: catId.get(spec.category) ?? null,
      },
      create: {
        organizationId: org.id, sku: spec.sku, name: spec.name,
        categoryId: catId.get(spec.category) ?? null, unit: spec.unit,
        salePrice: spec.salePrice, purchasePrice: spec.purchasePrice,
        alertThreshold: spec.alertThreshold, supplierName: spec.supplier, status: "ACTIVE",
      },
    });
    if ((await prisma.stockMovement.count({ where: { productId: product.id } })) === 0) {
      await prisma.stockMovement.create({
        data: { organizationId: org.id, productId: product.id, type: "INITIAL", quantity: spec.initial, reason: "Stock initial (démo)", actorUserId: owner.id, metadata: { source: "seed-staging" } },
      });
      for (const mv of spec.moves ?? []) {
        await prisma.stockMovement.create({
          data: { organizationId: org.id, productId: product.id, type: mv.type, quantity: mv.qty, reason: mv.reason, actorUserId: owner.id, metadata: { source: "seed-staging" } },
        });
      }
    }
  }

  // ── Clients ──
  const custId = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const row = await prisma.customer.upsert({
      where: { organizationId_phone: { organizationId: org.id, phone: c.phone } },
      update: { displayName: c.displayName, customerType: c.type, area: c.area, assignedToUserId: c.assignTo === "sales" ? sales.id : null },
      create: {
        organizationId: org.id, displayName: c.displayName, phone: c.phone,
        customerType: c.type, area: c.area, city: "Bamako", countryCode: "ML",
        status: "ACTIVE", source: "MANUAL",
        assignedToUserId: c.assignTo === "sales" ? sales.id : null,
        marketingOptIn: true,
      },
    });
    custId.set(c.displayName, row.id);
  }
  // Un client désinscrit du marketing (pour l'aperçu d'audience).
  await prisma.customer.update({ where: { id: custId.get("Revente Traoré")! }, data: { marketingOptIn: false, marketingOptOutAt: new Date() } });

  const prod = async (sku: string) =>
    prisma.product.findUniqueOrThrow({ where: { organizationId_sku: { organizationId: org.id, sku } }, select: { id: true, name: true, salePrice: true } });

  // ── Commandes (créées une seule fois) ──
  if ((await prisma.order.count({ where: { organizationId: org.id } })) === 0) {
    let n = 0;
    for (const spec of ORDERS) {
      n += 1;
      const reference = `CMD-${String(n).padStart(4, "0")}`;
      const createdAt = new Date(Date.now() + (spec.ageDays ?? 0) * 86_400_000);
      const resolved = await Promise.all(spec.lines.map(async (l) => ({ ...l, p: await prod(l.sku) })));
      const subtotal = resolved.reduce((s, l) => s + l.p.salePrice * l.qty, 0);
      const delivered = spec.status === "DELIVERED";
      const dueDate = typeof spec.dueInDays === "number" ? new Date(Date.now() + spec.dueInDays * 86_400_000) : null;
      const paid = (spec.payments ?? []).reduce((s, a) => s + a, 0);

      const order = await prisma.order.create({
        data: {
          organizationId: org.id, customerId: custId.get(spec.customer)!,
          orderNumber: n, reference,
          status: spec.status,
          paymentStatus: delivered ? derivePaymentStatus(subtotal, paid, { creditMode: dueDate != null }) : "UNPAID",
          source: "MANUAL", subtotal, discountAmount: 0, deliveryFee: 0, totalAmount: subtotal,
          amountPaid: delivered ? paid : 0, currency: "XOF",
          createdByUserId: spec.customer.includes("Kéné") || spec.customer.includes("Sabali") ? sales.id : owner.id,
          createdAt,
          ...(delivered ? { deliveredAt: createdAt, dueDate, confirmedAt: createdAt, confirmedByUserId: owner.id } : {}),
          ...(spec.status === "CANCELLED" ? { cancelledAt: createdAt, cancellationReason: "Annulée par le client (démo)" } : {}),
          ...(["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"].includes(spec.status) ? { confirmedAt: createdAt, confirmedByUserId: owner.id } : {}),
        },
      });

      for (const l of resolved) {
        await prisma.orderItem.create({
          data: {
            organizationId: org.id, orderId: order.id, productId: l.p.id,
            productNameSnapshot: l.p.name, skuSnapshot: l.sku,
            quantity: l.qty, unitPrice: l.p.salePrice, subtotal: l.p.salePrice * l.qty,
          },
        });
        if (delivered) {
          await prisma.stockMovement.create({
            data: { organizationId: org.id, productId: l.p.id, type: "SALE", quantity: l.qty, reference, actorUserId: owner.id, metadata: { orderId: order.id, source: "seed-staging" } },
          });
        } else if (spec.status !== "CANCELLED") {
          await prisma.stockReservation.create({
            data: { organizationId: org.id, productId: l.p.id, quantity: l.qty, status: "ACTIVE", sourceType: "ORDER", sourceId: order.id },
          });
        }
      }

      await prisma.orderStatusHistory.create({
        data: { organizationId: org.id, orderId: order.id, fromStatus: null, toStatus: spec.status, actorUserId: owner.id, source: "MANUAL", createdAt },
      });

      for (const amount of spec.payments ?? []) {
        await prisma.payment.create({
          data: { organizationId: org.id, customerId: order.customerId, orderId: order.id, amount, currency: "XOF", method: "CASH", status: "CONFIRMED", recordedByUserId: owner.id, paidAt: createdAt, metadata: { source: "seed-staging" } },
        });
      }

      if (spec.staleHours) {
        await prisma.order.update({ where: { id: order.id }, data: { updatedAt: new Date(Date.now() - spec.staleHours * 3_600_000) } });
      }
    }
    await prisma.orderCounter.upsert({
      where: { organizationId: org.id },
      update: { lastNumber: ORDERS.length },
      create: { organizationId: org.id, lastNumber: ORDERS.length },
    });
  }

  // ── WhatsApp (mock) + conversations DÉMO ──
  const conn = await prisma.whatsAppConnection.upsert({
    where: { phoneNumberId: "demo-phone-number-id" },
    update: { status: "CONNECTED" },
    create: {
      organizationId: org.id, provider: "MOCK", phoneNumberId: "demo-phone-number-id",
      displayPhoneNumber: "+223 90 00 00 00", verifiedName: "FEREDRON DEMO COMMERCE",
      status: "CONNECTED", connectedAt: new Date(),
    },
  });

  if ((await prisma.conversation.count({ where: { organizationId: org.id } })) === 0) {
    const CONV = [
      {
        wa: "22391000001", customer: "Boutique Kéné", lang: "FR",
        msgs: [
          { dir: "INBOUND" as const, body: "Bonjour, tu as du sucre ?", minsAgo: 55 },
          { dir: "OUTBOUND" as const, body: "Oui, il reste 42 sacs disponibles de sucre 50 kg à 28 500 FCFA.", minsAgo: 53 },
          { dir: "INBOUND" as const, body: "Mets-moi 6 sacs.", minsAgo: 40 },
          { dir: "OUTBOUND" as const, body: "C'est noté : 6 × Sucre 50 kg = 171 000 FCFA. Je prépare le bon de commande, un membre de l'équipe confirme.", minsAgo: 39, ai: true },
        ],
        draft: { sku: "SUC-050", qty: 6 },
      },
      {
        wa: "22391000006", customer: "Épicerie Nafama", lang: "BM",
        msgs: [
          { dir: "INBOUND" as const, body: "Aw ni sɔgɔma, sukaro sɔngɔ ye joli ye ?", minsAgo: 120 },
          { dir: "OUTBOUND" as const, body: "Sucre 25 kg : 15 200 FCFA. Sucre 50 kg : 28 500 FCFA. (réponse démo)", minsAgo: 118 },
        ],
      },
      {
        wa: "22391000004", customer: "Restaurant Teriya", lang: "MIXED",
        msgs: [
          { dir: "INBOUND" as const, body: "N b'a fɛ, ajoute-moi 2 cartons de lait.", minsAgo: 200 },
          { dir: "OUTBOUND" as const, body: "Bien reçu : 2 cartons de lait en poudre. Je prépare ça (exemple démo, code-switching FR/BM).", minsAgo: 198 },
        ],
      },
    ];

    for (const c of CONV) {
      const conv = await prisma.conversation.create({
        data: {
          organizationId: org.id, whatsappConnectionId: conn.id, customerId: custId.get(c.customer)!,
          externalWaId: c.wa, mode: "HUMAN", status: "OPEN",
          lastInboundAt: new Date(Date.now() - (c.msgs[0]?.minsAgo ?? 60) * 60_000),
          lastMessageAt: new Date(),
        },
      });
      let firstInbound: string | null = null;
      for (const m of c.msgs) {
        const msg = await prisma.message.create({
          data: {
            organizationId: org.id, conversationId: conv.id, whatsappConnectionId: conn.id,
            customerId: conv.customerId, direction: m.dir, type: "TEXT",
            status: m.dir === "INBOUND" ? "RECEIVED" : "SENT", body: m.body,
            generatedByAi: "ai" in m ? true : false,
            providerTimestamp: new Date(Date.now() - m.minsAgo * 60_000),
            createdAt: new Date(Date.now() - m.minsAgo * 60_000),
            externalMessageId: `demo-${conv.id}-${m.minsAgo}`,
          },
        });
        if (m.dir === "INBOUND" && !firstInbound) firstInbound = msg.id;
      }
      if (c.draft) {
        const p = await prod(c.draft.sku);
        const draft = await prisma.orderDraft.create({
          data: {
            organizationId: org.id, conversationId: conv.id, customerId: conv.customerId,
            createdByUserId: null, sourceMessageId: firstInbound, status: "AWAITING_HUMAN_APPROVAL",
            currency: "XOF", subtotal: p.salePrice * c.draft.qty, totalAmount: p.salePrice * c.draft.qty,
            notes: "Brouillon préparé depuis WhatsApp (démo)",
          },
        });
        await prisma.orderDraftItem.create({
          data: {
            organizationId: org.id, orderDraftId: draft.id, productId: p.id,
            productNameSnapshot: p.name, skuSnapshot: c.draft.sku,
            quantity: c.draft.qty, unitPrice: p.salePrice, subtotal: p.salePrice * c.draft.qty,
          },
        });
      }
    }
  }

  // ── Abonnement + passe d'automatisation (recommandations + résumé du jour) ──
  const { getOrCreateSubscription } = await import("../src/server/billing/subscription-service.ts");
  await getOrCreateSubscription(org.id, { planCode: "BUSINESS" });

  const { runAutomationsForOrganization } = await import("../src/server/automations/automation-service.ts");
  const pass = await runAutomationsForOrganization({
    organizationId: org.id, timezone: org.timezone, currency: org.currency, ignoreEnabled: true,
  });

  return {
    organization: DEMO_ORG_NAME,
    accounts: PEOPLE.length,
    products: PRODUCTS.length,
    categories: CATEGORIES.length,
    customers: CUSTOMERS.length,
    orders: await prisma.order.count({ where: { organizationId: org.id } }),
    conversations: await prisma.conversation.count({ where: { organizationId: org.id } }),
    recommendations: pass.created + pass.updated,
  };
}

// Exécution directe (npm run demo:seed)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("seed-staging.ts")) {
  main()
    .then(async () => {
      await prisma.$disconnect();
      // Les modules de service importés dynamiquement peuvent garder l'event
      // loop actif : on sort explicitement une fois le seed terminé.
      process.exit(0);
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    });
}
