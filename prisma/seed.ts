/**
 * Seed de DÉVELOPPEMENT uniquement. Ne jamais exécuter en production.
 *
 *   npm run db:seed
 *
 * Crée une entreprise de démonstration « Djeli Commerce Demo » avec un
 * propriétaire et quatre membres (un par rôle). Mot de passe commun : password123
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { derivePaymentStatus } from "../src/server/finance/payment-rules.ts";
import { buildReminderMessage } from "../src/server/finance/reminder-template.ts";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  console.error("Refus : le seed ne doit pas être exécuté en production.");
  process.exit(1);
}

const PASSWORD = "password123";

const PEOPLE: Array<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "SALES" | "EMPLOYEE";
}> = [
  { firstName: "Moussa", lastName: "Keïta", email: "moussa@djeli.demo", phone: "+22376123456", role: "OWNER" },
  { firstName: "Awa", lastName: "Traoré", email: "awa@djeli.demo", phone: "+22365882014", role: "ADMIN" },
  { firstName: "Ibrahim", lastName: "Diallo", email: "ibrahim@djeli.demo", phone: "+22370459003", role: "MANAGER" },
  { firstName: "Fatoumata", lastName: "Sidibé", email: "fatou@djeli.demo", phone: "+22379116247", role: "SALES" },
  { firstName: "Oumar", lastName: "Coulibaly", email: "oumar@djeli.demo", phone: "+22366037721", role: "EMPLOYEE" },
];

async function main() {
  // §54 — ne JAMAIS lancer le seed de démonstration en production.
  if (process.env.APP_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    console.error(
      "✗ Seed de démonstration refusé : APP_ENV=production. Définir ALLOW_DEMO_SEED=1 uniquement en connaissance de cause.",
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const users = [];
  for (const p of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { firstName: p.firstName, lastName: p.lastName, phone: p.phone },
      create: {
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        passwordHash,
      },
    });
    users.push({ ...p, id: user.id });
  }

  const owner = users.find((u) => u.role === "OWNER")!;

  const org = await prisma.organization.upsert({
    where: { slug: "djeli-commerce-demo" },
    update: { name: "Djeli Commerce Demo" },
    create: {
      name: "Djeli Commerce Demo",
      slug: "djeli-commerce-demo",
      countryCode: "ML",
      currency: "XOF",
      timezone: "Africa/Bamako",
      city: "Bamako",
      district: "Hamdallaye ACI 2000",
      businessType: "WHOLESALE",
      ownerUserId: owner.id,
      onboardedAt: new Date(),
    },
  });

  for (const u of users) {
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: org.id, userId: u.id },
      },
      update: { role: u.role, status: "ACTIVE" },
      create: {
        organizationId: org.id,
        userId: u.id,
        role: u.role,
        status: "ACTIVE",
      },
    });
  }

  // Une invitation en attente pour la démo.
  await prisma.invitation.upsert({
    where: { token: "demo-pending-invitation-token" },
    update: {},
    create: {
      organizationId: org.id,
      phone: "+22375009900",
      role: "SALES",
      token: "demo-pending-invitation-token",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      invitedByUserId: owner.id,
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: org.id,
        actorUserId: owner.id,
        action: "ORGANIZATION_CREATED",
        entityType: "organization",
        entityId: org.id,
      },
      {
        organizationId: org.id,
        actorUserId: owner.id,
        action: "MEMBER_INVITED",
        entityType: "invitation",
      },
    ],
  });

  // ── Phase 2 : catégories, produits, mouvements, réservation ──
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const CATEGORIES = ["Riz", "Sucre", "Huile", "Lait", "Hygiène"];
  const categoryByName = new Map<string, string>();
  for (const name of CATEGORIES) {
    const cat = await prisma.productCategory.upsert({
      where: {
        organizationId_slug: { organizationId: org.id, slug: slugify(name) },
      },
      update: { name },
      create: { organizationId: org.id, name, slug: slugify(name) },
    });
    categoryByName.set(name, cat.id);
  }

  const PRODUCTS: Array<{
    sku: string;
    name: string;
    category: string;
    unit:
      | "SAC"
      | "BIDON"
      | "CARTON"
      | "PAQUET";
    salePrice: number;
    purchasePrice: number;
    alertThreshold: number;
    supplierName: string;
    initial: number;
    extra: Array<{
      type:
        | "PURCHASE"
        | "SALE"
        | "ADJUSTMENT_OUT"
        | "RETURN_IN";
      quantity: number;
      reason: string;
    }>;
  }> = [
    {
      sku: "RIZ-025",
      name: "Riz brisé Gambiaka 25 kg",
      category: "Riz",
      unit: "SAC",
      salePrice: 18750,
      purchasePrice: 16200,
      alertThreshold: 40,
      supplierName: "Import Sikasso",
      initial: 120,
      extra: [
        { type: "PURCHASE", quantity: 80, reason: "Réception fournisseur" },
        { type: "SALE", quantity: 62, reason: "Ventes comptoir" },
      ],
    },
    {
      sku: "SUC-050",
      name: "Sucre cristallisé 50 kg",
      category: "Sucre",
      unit: "SAC",
      salePrice: 31500,
      purchasePrice: 27200,
      alertThreshold: 20,
      supplierName: "Sucrerie de Ségou",
      initial: 60,
      extra: [
        { type: "SALE", quantity: 14, reason: "Ventes comptoir" },
        { type: "ADJUSTMENT_OUT", quantity: 3, reason: "Inventaire — casse" },
      ],
    },
    {
      sku: "HUI-020",
      name: "Huile de palme 20 L",
      category: "Huile",
      unit: "BIDON",
      salePrice: 24000,
      purchasePrice: 21000,
      alertThreshold: 15,
      supplierName: "Huilerie Abidjan",
      initial: 18,
      extra: [{ type: "SALE", quantity: 9, reason: "Ventes comptoir" }],
    },
    {
      sku: "LAI-025",
      name: "Lait en poudre 2,5 kg",
      category: "Lait",
      unit: "CARTON",
      salePrice: 9800,
      purchasePrice: 8100,
      alertThreshold: 25,
      supplierName: "Distrib. Bamako",
      initial: 64,
      extra: [{ type: "RETURN_IN", quantity: 2, reason: "Retour client" }],
    },
    {
      sku: "SAV-040",
      name: "Savon de Marseille (carton 40)",
      category: "Hygiène",
      unit: "CARTON",
      salePrice: 12400,
      purchasePrice: 9800,
      alertThreshold: 10,
      supplierName: "Savonnerie du Fleuve",
      initial: 12,
      extra: [{ type: "SALE", quantity: 12, reason: "Grosse commande" }],
    },
  ];

  for (const spec of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: {
        organizationId_sku: { organizationId: org.id, sku: spec.sku },
      },
      update: {
        name: spec.name,
        salePrice: spec.salePrice,
        purchasePrice: spec.purchasePrice,
        alertThreshold: spec.alertThreshold,
      },
      create: {
        organizationId: org.id,
        sku: spec.sku,
        name: spec.name,
        categoryId: categoryByName.get(spec.category) ?? null,
        unit: spec.unit,
        salePrice: spec.salePrice,
        purchasePrice: spec.purchasePrice,
        alertThreshold: spec.alertThreshold,
        supplierName: spec.supplierName,
        status: "ACTIVE",
      },
    });

    const already = await prisma.stockMovement.count({
      where: { productId: product.id },
    });
    if (already === 0) {
      await prisma.stockMovement.create({
        data: {
          organizationId: org.id,
          productId: product.id,
          type: "INITIAL",
          quantity: spec.initial,
          reason: "Stock initial",
          actorUserId: owner.id,
          metadata: { source: "seed" },
        },
      });
      for (const mv of spec.extra) {
        await prisma.stockMovement.create({
          data: {
            organizationId: org.id,
            productId: product.id,
            type: mv.type,
            quantity: mv.quantity,
            reason: mv.reason,
            actorUserId: owner.id,
            metadata: { source: "seed" },
          },
        });
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      actorUserId: owner.id,
      action: "PRODUCT_CREATED",
      entityType: "product",
      metadata: { seeded: PRODUCTS.length },
    },
  });

  // ── Phase 3 : clients + commandes de démonstration ──
  const sales = users.find((u) => u.role === "SALES")!;
  const CUSTOMERS: Array<{
    displayName: string;
    firstName: string;
    lastName: string;
    phone: string;
    area: string;
    type: "DETAILLANT" | "GROSSISTE";
    assignedTo?: string;
  }> = [
    { displayName: "Aminata Sanogo", firstName: "Aminata", lastName: "Sanogo", phone: "+22378441209", area: "Magnambougou", type: "DETAILLANT", assignedTo: sales.id },
    { displayName: "Sekou Coulibaly", firstName: "Sekou", lastName: "Coulibaly", phone: "+22376093351", area: "Sogoniko", type: "GROSSISTE" },
    { displayName: "Mariam Doumbia", firstName: "Mariam", lastName: "Doumbia", phone: "+22366710528", area: "Hamdallaye", type: "DETAILLANT", assignedTo: sales.id },
    { displayName: "Boubacar Cissé", firstName: "Boubacar", lastName: "Cissé", phone: "+22370228460", area: "Banankabougou", type: "DETAILLANT" },
    { displayName: "Kadidia Traoré", firstName: "Kadidia", lastName: "Traoré", phone: "+22379554112", area: "Kalaban Coura", type: "GROSSISTE" },
  ];
  const customerByName = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const created = await prisma.customer.upsert({
      where: {
        organizationId_phone: { organizationId: org.id, phone: c.phone },
      },
      update: { displayName: c.displayName },
      create: {
        organizationId: org.id,
        firstName: c.firstName,
        lastName: c.lastName,
        displayName: c.displayName,
        phone: c.phone,
        area: c.area,
        city: "Bamako",
        countryCode: "ML",
        customerType: c.type,
        status: "ACTIVE",
        source: "MANUAL",
        assignedToUserId: c.assignedTo ?? null,
      },
    });
    customerByName.set(c.displayName, created.id);
  }

  const orderRef = (n: number) => `CMD-${String(n).padStart(4, "0")}`;
  const skuId = async (sku: string) =>
    (await prisma.product.findUniqueOrThrow({
      where: { organizationId_sku: { organizationId: org.id, sku } },
      select: { id: true, name: true, salePrice: true },
    }));

  if ((await prisma.order.count({ where: { organizationId: org.id } })) === 0) {
    const ORDERS: Array<{
      customer: string;
      lines: Array<{ sku: string; qty: number }>;
      to?: "CONFIRMED" | "DELIVERED";
      /** Décalage d'échéance en jours (négatif = passée). Ventes à crédit. */
      dueInDays?: number;
      /** Paiements CONFIRMED à enregistrer (commandes livrées). */
      payments?: number[];
    }> = [
      { customer: "Aminata Sanogo", lines: [{ sku: "RIZ-025", qty: 6 }] },
      {
        customer: "Sekou Coulibaly",
        lines: [
          { sku: "SUC-050", qty: 4 },
          { sku: "LAI-025", qty: 10 },
        ],
        to: "CONFIRMED",
      },
      // Créance soldée : livrée + payée intégralement.
      {
        customer: "Kadidia Traoré",
        lines: [{ sku: "HUI-020", qty: 3 }],
        to: "DELIVERED",
        payments: [72000],
      },
      // Créance EN RETARD : livrée, échéance passée, rien payé.
      {
        customer: "Aminata Sanogo",
        lines: [{ sku: "RIZ-025", qty: 2 }],
        to: "DELIVERED",
        dueInDays: -12,
      },
      // Créance partielle EN RETARD : livrée, échéance passée, acompte versé.
      {
        customer: "Boubacar Cissé",
        lines: [{ sku: "LAI-025", qty: 4 }],
        to: "DELIVERED",
        dueInDays: -3,
        payments: [20000],
      },
      // Vente à crédit à échoir : livrée, échéance future, rien payé.
      {
        customer: "Mariam Doumbia",
        lines: [{ sku: "LAI-025", qty: 5 }],
        to: "DELIVERED",
        dueInDays: 15,
      },
    ];

    let n = 0;
    for (const spec of ORDERS) {
      n += 1;
      const reference = orderRef(n);
      const resolved = await Promise.all(
        spec.lines.map(async (l) => ({ ...l, product: await skuId(l.sku) })),
      );
      const subtotal = resolved.reduce(
        (s, l) => s + l.product.salePrice * l.qty,
        0,
      );
      const order = await prisma.order.create({
        data: {
          organizationId: org.id,
          customerId: customerByName.get(spec.customer)!,
          orderNumber: n,
          reference,
          status: "NEW",
          paymentStatus: "UNPAID",
          source: "MANUAL",
          subtotal,
          discountAmount: 0,
          deliveryFee: 0,
          totalAmount: subtotal,
          currency: "XOF",
          createdByUserId: owner.id,
        },
      });
      for (const l of resolved) {
        await prisma.orderItem.create({
          data: {
            organizationId: org.id,
            orderId: order.id,
            productId: l.product.id,
            productNameSnapshot: l.product.name,
            skuSnapshot: l.sku,
            quantity: l.qty,
            unitPrice: l.product.salePrice,
            subtotal: l.product.salePrice * l.qty,
          },
        });
        await prisma.stockReservation.create({
          data: {
            organizationId: org.id,
            productId: l.product.id,
            quantity: l.qty,
            status: "ACTIVE",
            sourceType: "ORDER",
            sourceId: order.id,
          },
        });
      }
      await prisma.orderStatusHistory.create({
        data: {
          organizationId: org.id,
          orderId: order.id,
          fromStatus: null,
          toStatus: "NEW",
          actorUserId: owner.id,
          source: "MANUAL",
        },
      });
      await prisma.customerActivity.create({
        data: {
          organizationId: org.id,
          customerId: order.customerId,
          type: "ORDER_CREATED",
          title: `Commande ${reference} créée`,
          actorUserId: owner.id,
        },
      });

      if (spec.to === "CONFIRMED") {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "CONFIRMED",
            confirmedByUserId: owner.id,
            confirmedAt: new Date(),
          },
        });
        await prisma.orderStatusHistory.create({
          data: {
            organizationId: org.id,
            orderId: order.id,
            fromStatus: "NEW",
            toStatus: "CONFIRMED",
            actorUserId: owner.id,
            source: "MANUAL",
          },
        });
      }

      if (spec.to === "DELIVERED") {
        for (const l of resolved) {
          await prisma.stockMovement.create({
            data: {
              organizationId: org.id,
              productId: l.product.id,
              type: "SALE",
              quantity: l.qty,
              reference,
              actorUserId: owner.id,
              metadata: { orderId: order.id, source: "seed" },
            },
          });
        }
        await prisma.stockReservation.updateMany({
          where: { sourceId: order.id, status: "ACTIVE" },
          data: { status: "FULFILLED", fulfilledAt: new Date() },
        });

        const dueDate =
          typeof spec.dueInDays === "number"
            ? new Date(Date.now() + spec.dueInDays * 86_400_000)
            : null;
        const paid = (spec.payments ?? []).reduce((s, a) => s + a, 0);
        const total = subtotal;

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "DELIVERED",
            deliveredAt: new Date(),
            dueDate,
            amountPaid: paid,
            paymentStatus: derivePaymentStatus(total, paid, {
              creditMode: dueDate != null,
            }),
          },
        });

        for (const amount of spec.payments ?? []) {
          const payment = await prisma.payment.create({
            data: {
              organizationId: org.id,
              customerId: order.customerId,
              orderId: order.id,
              amount,
              currency: "XOF",
              method: "CASH",
              status: "CONFIRMED",
              recordedByUserId: owner.id,
              metadata: { source: "seed" },
            },
          });
          await prisma.customerActivity.create({
            data: {
              organizationId: org.id,
              customerId: order.customerId,
              type: "PAYMENT_RECORDED",
              title: `Paiement encaissé — ${reference}`,
              actorUserId: owner.id,
              metadata: { paymentId: payment.id, orderId: order.id, amount },
            },
          });
          await prisma.auditLog.create({
            data: {
              organizationId: org.id,
              actorUserId: owner.id,
              action: "PAYMENT_RECORDED",
              entityType: "payment",
              entityId: payment.id,
              metadata: { orderId: order.id, amount },
            },
          });
        }
        if (dueDate && paid < total) {
          await prisma.customerActivity.create({
            data: {
              organizationId: org.id,
              customerId: order.customerId,
              type: "DEBT_CREATED",
              title: `Créance ouverte sur ${reference}`,
              actorUserId: owner.id,
              metadata: { orderId: order.id, balanceDue: total - paid },
            },
          });
        }
        for (const to of ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as const) {
          await prisma.orderStatusHistory.create({
            data: {
              organizationId: org.id,
              orderId: order.id,
              toStatus: to,
              actorUserId: owner.id,
              source: "MANUAL",
            },
          });
        }
        await prisma.customerActivity.create({
          data: {
            organizationId: org.id,
            customerId: order.customerId,
            type: "ORDER_DELIVERED",
            title: `Commande ${reference} livrée`,
            actorUserId: owner.id,
          },
        });
      }
    }

    await prisma.orderCounter.upsert({
      where: { organizationId: org.id },
      update: { lastNumber: n },
      create: { organizationId: org.id, lastNumber: n },
    });

    // ── Phase 4 : une campagne de relance (brouillon, envoi simulé) ──
    const overdue = await prisma.order.findMany({
      where: {
        organizationId: org.id,
        status: "DELIVERED",
        paymentStatus: { not: "PAID" },
        dueDate: { lt: new Date() },
      },
      include: { customer: { select: { id: true, displayName: true } } },
    });
    if (overdue.length > 0) {
      const campaign = await prisma.reminderCampaign.create({
        data: {
          organizationId: org.id,
          name: "Relances créances en retard",
          status: "DRAFT",
          createdByUserId: owner.id,
        },
      });
      for (const o of overdue) {
        const bal = o.totalAmount - o.amountPaid;
        await prisma.reminderCampaignItem.create({
          data: {
            organizationId: org.id,
            campaignId: campaign.id,
            customerId: o.customer.id,
            orderId: o.id,
            amountDue: bal,
            message: buildReminderMessage({
              customerName: o.customer.displayName,
              organizationName: org.name,
              orderReference: o.reference,
              balanceDue: bal,
              currency: "XOF",
              dueDate: o.dueDate,
            }),
            status: "PENDING",
          },
        });
        await prisma.customerActivity.create({
          data: {
            organizationId: org.id,
            customerId: o.customer.id,
            type: "REMINDER_PREPARED",
            title: "Relance préparée",
            actorUserId: owner.id,
            metadata: { campaignId: campaign.id },
          },
        });
      }
      await prisma.auditLog.create({
        data: {
          organizationId: org.id,
          actorUserId: owner.id,
          action: "REMINDER_CAMPAIGN_CREATED",
          entityType: "reminder_campaign",
          entityId: campaign.id,
          metadata: { itemCount: overdue.length },
        },
      });
    }
  }

  // ── Phase 5 : connexion WhatsApp (mock) + conversations de démo ──
  const waConnection = await prisma.whatsAppConnection.upsert({
    where: { phoneNumberId: "demo-pnid-djeli" },
    update: { status: "CONNECTED" },
    create: {
      organizationId: org.id,
      provider: "MOCK",
      phoneNumberId: "demo-pnid-djeli",
      businessAccountId: "demo-waba-djeli",
      displayPhoneNumber: "+223 76 00 00 00",
      verifiedName: "Djeli Commerce Demo",
      accessTokenEncrypted: null,
      status: "CONNECTED",
      connectedAt: new Date(),
      lastEventAt: new Date(),
    },
  });

  if (
    (await prisma.conversation.count({ where: { organizationId: org.id } })) === 0
  ) {
    const H = 3_600_000;
    const THREADS: Array<{
      customer: string;
      waId: string;
      mode: "AUTO" | "HUMAN" | "PAUSED";
      lastInboundHoursAgo: number;
      unread: number;
      messages: Array<{ dir: "IN" | "OUT"; body: string; hoursAgo: number }>;
    }> = [
      {
        customer: "Aminata Sanogo",
        waId: "22378441209",
        mode: "AUTO",
        lastInboundHoursAgo: 1,
        unread: 2,
        messages: [
          { dir: "IN", body: "Bonjour, il me faut 6 sacs de riz.", hoursAgo: 2 },
          { dir: "OUT", body: "Bonjour Aminata, je prépare ça.", hoursAgo: 1.8 },
          { dir: "IN", body: "Livraison possible demain matin ?", hoursAgo: 1 },
          { dir: "IN", body: "Merci d'avance 🙏", hoursAgo: 1 },
        ],
      },
      {
        customer: "Sekou Coulibaly",
        waId: "22376093351",
        mode: "HUMAN",
        lastInboundHoursAgo: 5,
        unread: 0,
        messages: [
          { dir: "IN", body: "Facture reçue, merci.", hoursAgo: 5 },
          { dir: "OUT", body: "Parfait, à bientôt Sekou.", hoursAgo: 4.8 },
        ],
      },
      {
        customer: "Mariam Doumbia",
        waId: "22366710528",
        mode: "HUMAN",
        lastInboundHoursAgo: 30, // fenêtre 24 h FERMÉE
        unread: 1,
        messages: [
          { dir: "IN", body: "Je passe payer vendredi.", hoursAgo: 30 },
        ],
      },
      {
        customer: "Boubacar Cissé",
        waId: "22370228460",
        mode: "PAUSED",
        lastInboundHoursAgo: 10,
        unread: 1,
        messages: [
          { dir: "IN", body: "Le carton de lait était abîmé.", hoursAgo: 10 },
        ],
      },
    ];

    let seq = 0;
    for (const t of THREADS) {
      const customerId = customerByName.get(t.customer)!;
      const lastInboundAt = new Date(Date.now() - t.lastInboundHoursAgo * H);
      const outMsgs = t.messages.filter((m) => m.dir === "OUT");
      const lastOutboundAt =
        outMsgs.length > 0
          ? new Date(Date.now() - outMsgs[outMsgs.length - 1]!.hoursAgo * H)
          : null;

      const conversation = await prisma.conversation.create({
        data: {
          organizationId: org.id,
          whatsappConnectionId: waConnection.id,
          customerId,
          externalWaId: t.waId,
          mode: t.mode,
          status: "OPEN",
          unreadCount: t.unread,
          lastInboundAt,
          lastOutboundAt,
          lastMessageAt: new Date(
            Date.now() -
              Math.min(...t.messages.map((m) => m.hoursAgo)) * H,
          ),
        },
      });

      for (const m of t.messages) {
        seq += 1;
        const at = new Date(Date.now() - m.hoursAgo * H);
        await prisma.message.create({
          data: {
            organizationId: org.id,
            conversationId: conversation.id,
            whatsappConnectionId: waConnection.id,
            customerId,
            externalMessageId:
              m.dir === "IN" ? `seed-in-${seq}` : `seed-out-${seq}`,
            direction: m.dir === "IN" ? "INBOUND" : "OUTBOUND",
            type: "TEXT",
            status: m.dir === "IN" ? "RECEIVED" : "DELIVERED",
            body: m.body,
            sentByUserId: m.dir === "OUT" ? owner.id : null,
            providerTimestamp: at,
            createdAt: at,
          },
        });
      }

      await prisma.customerActivity.create({
        data: {
          organizationId: org.id,
          customerId,
          type: "MESSAGE_RECEIVED",
          title: t.messages.find((m) => m.dir === "IN")?.body ?? "Message reçu",
          metadata: { conversationId: conversation.id, type: "TEXT" },
        },
      });
    }
  }

  // ── Phase 6 : Djeli IA — brouillon de commande de démonstration ──
  // Conversation AUTO d'Aminata : échange sucre + brouillon « à valider ».
  if ((await prisma.orderDraft.count({ where: { organizationId: org.id } })) === 0) {
    const aminataConv = await prisma.conversation.findFirst({
      where: { organizationId: org.id, customer: { displayName: "Aminata Sanogo" } },
      select: { id: true, customerId: true, whatsappConnectionId: true },
    });
    const sucre = await prisma.product.findUnique({
      where: { organizationId_sku: { organizationId: org.id, sku: "SUC-050" } },
      select: { id: true, name: true, sku: true, salePrice: true },
    });
    if (aminataConv?.customerId && sucre) {
      const now = Date.now();
      const aiRun = await prisma.aiRun.create({
        data: {
          organizationId: org.id,
          conversationId: aminataConv.id,
          automationType: "WHATSAPP_AUTO_REPLY",
          intent: "PRODUCT_AVAILABILITY",
          provider: "mock",
          model: "mock-1",
          promptVersion: "2026-08-djeli-ia-v1",
          status: "SUCCEEDED",
          confidence: "HIGH",
          language: "FR",
        },
      });
      for (const m of [
        { dir: "IN" as const, body: "Bonjour, vous avez du sucre 50 kg ?", h: 0.9, ai: false },
        {
          dir: "OUT" as const,
          body: `Oui, il reste 43 sacs de ${sucre.name}, à 31 500 FCFA. Combien en souhaitez-vous ?`,
          h: 0.8,
          ai: true,
        },
        { dir: "IN" as const, body: "Mettez-moi 6 sacs", h: 0.6, ai: false },
        {
          dir: "OUT" as const,
          body: `J'ai préparé : 6 × ${sucre.name} à 31 500 FCFA/unité. Total : 189 000 FCFA. Souhaitez-vous confirmer ?`,
          h: 0.5,
          ai: true,
        },
      ]) {
        await prisma.message.create({
          data: {
            organizationId: org.id,
            conversationId: aminataConv.id,
            whatsappConnectionId: aminataConv.whatsappConnectionId,
            customerId: aminataConv.customerId,
            externalMessageId: `seed-ai-${Math.round(m.h * 100)}`,
            direction: m.dir === "IN" ? "INBOUND" : "OUTBOUND",
            type: "TEXT",
            status: m.dir === "IN" ? "RECEIVED" : "DELIVERED",
            body: m.body,
            generatedByAi: m.ai,
            aiRunId: m.ai ? aiRun.id : null,
            providerTimestamp: new Date(now - m.h * 3_600_000),
            createdAt: new Date(now - m.h * 3_600_000),
          },
        });
      }
      const draft = await prisma.orderDraft.create({
        data: {
          organizationId: org.id,
          conversationId: aminataConv.id,
          customerId: aminataConv.customerId,
          sourceMessageId: "seed-ai-60",
          status: "AWAITING_HUMAN_APPROVAL",
          currency: "XOF",
          subtotal: sucre.salePrice * 6,
          totalAmount: sucre.salePrice * 6,
          expiresAt: new Date(now + 48 * 3_600_000),
          items: {
            create: [
              {
                organizationId: org.id,
                productId: sucre.id,
                productNameSnapshot: sucre.name,
                skuSnapshot: sucre.sku,
                quantity: 6,
                unitPrice: sucre.salePrice,
                subtotal: sucre.salePrice * 6,
              },
            ],
          },
        },
      });
      await prisma.customerActivity.create({
        data: {
          organizationId: org.id,
          customerId: aminataConv.customerId,
          type: "AI_ORDER_DRAFT_CREATED",
          title: "Djeli IA a préparé un brouillon de commande (189000)",
          metadata: { draftId: draft.id, conversationId: aminataConv.id },
        },
      });
    }
  }

  // ── Phase 6B : Djeli Voice — messages vocaux + transcriptions de démo ──
  if (
    (await prisma.voiceTranscription.count({ where: { organizationId: org.id } })) === 0
  ) {
    const mariamConv = await prisma.conversation.findFirst({
      where: { organizationId: org.id, customer: { displayName: "Mariam Doumbia" } },
      select: { id: true, customerId: true, whatsappConnectionId: true },
    });
    if (mariamConv?.customerId) {
      const VOICES: Array<{
        ext: string;
        hoursAgo: number;
        original: string;
        corrected?: string;
        language: "FR" | "BM" | "MIXED";
        confidence: number;
        status: "COMPLETED" | "CORRECTED";
      }> = [
        {
          ext: "seed-voice-fr",
          hoursAgo: 6,
          original: "Bonjour, je veux six saques de sucre.",
          corrected: "Bonjour, je veux six sacs de sucre.",
          language: "FR",
          confidence: 0.82,
          status: "CORRECTED",
        },
        {
          ext: "seed-voice-bm",
          hoursAgo: 4,
          original: "Aw ni sɔgɔma, sukaro sɔngɔ ye joli ye ?",
          language: "BM",
          confidence: 0.71,
          status: "COMPLETED",
        },
        {
          ext: "seed-voice-mixed",
          hoursAgo: 2,
          original: "N b'a fɛ, ajoute-moi 2 cartons de lait.",
          language: "MIXED",
          confidence: 0.68,
          status: "COMPLETED",
        },
      ];
      for (const v of VOICES) {
        const at = new Date(Date.now() - v.hoursAgo * 3_600_000);
        const message = await prisma.message.create({
          data: {
            organizationId: org.id,
            conversationId: mariamConv.id,
            whatsappConnectionId: mariamConv.whatsappConnectionId,
            customerId: mariamConv.customerId,
            externalMessageId: v.ext,
            direction: "INBOUND",
            type: "AUDIO",
            status: "RECEIVED",
            mediaId: `seed-media-${v.ext}`,
            mediaMimeType: "audio/ogg",
            providerTimestamp: at,
            createdAt: at,
          },
        });
        const effective = v.corrected ?? v.original;
        await prisma.voiceTranscription.create({
          data: {
            organizationId: org.id,
            messageId: message.id,
            conversationId: mariamConv.id,
            provider: "mock",
            model: "mock-stt-1",
            originalText: v.original,
            correctedText: v.corrected ?? null,
            effectiveText: effective,
            normalizedText: effective.replace(/\s+/g, " ").trim(),
            detectedLanguage: v.language,
            providerLanguage: v.language.toLowerCase(),
            confidence: v.confidence,
            durationMs: 3200,
            audioSeconds: 3,
            status: v.status,
            ...(v.status === "CORRECTED"
              ? { correctedByUserId: owner.id, correctedAt: new Date() }
              : {}),
          },
        });
      }
    }
  }

  // ── Phase 6C : Djeli Language Core — données DEV/DEMO (pas une référence) ──
  {
    const bcryptMod = await import("bcryptjs");
    const commerce = await prisma.languageDomain.upsert({
      where: { code: "commerce" },
      update: { name: "Commerce" },
      create: { code: "commerce", name: "Commerce", description: "Vente, stock, commandes." },
    });

    const app = await prisma.languageApplication.upsert({
      where: { code: "DJELI_BUSINESS" },
      update: {
        allowedDomains: ["commerce"],
        allowedScopes: ["ORGANIZATION", "DOMAIN", "GLOBAL"],
      },
      create: {
        code: "DJELI_BUSINESS",
        name: "Djeli Business Assistant",
        allowedDomains: ["commerce"],
        allowedScopes: ["ORGANIZATION", "DOMAIN", "GLOBAL"],
      },
    });
    const demoSecret = process.env.LANGUAGE_DEMO_CLIENT_SECRET ?? "dev-language-secret-change-me";
    await prisma.languageApplicationClient.upsert({
      where: { clientId: "djeli-business" },
      update: {
        secretHash: await bcryptMod.default.hash(demoSecret, 10),
        permissions: [
          "language.read",
          "language.write",
          "language.export",
          "language.organization.read",
          "language.organization.write",
        ],
      },
      create: {
        applicationId: app.id,
        name: "Connecteur local (démo)",
        clientId: "djeli-business",
        secretHash: await bcryptMod.default.hash(demoSecret, 10),
        permissions: [
          "language.read",
          "language.write",
          "language.export",
          "language.organization.read",
          "language.organization.write",
        ],
      },
    });

    const norm = (s: string) =>
      s.replace(/[‘’ʼ]/g, "'").toLowerCase().replace(/\s+/g, " ")
        .replace(/^[\s.,;:!?…«»"'()-]+|[\s.,;:!?…«»"'()-]+$/g, "").trim();

    const DEMO_ENTRIES: Array<{
      canonical: string;
      language: "FR" | "BM" | "MIXED";
      scope: "GLOBAL" | "DOMAIN" | "ORGANIZATION";
      status: "VALIDATED" | "SUGGESTED";
      meaning: string;
      fr?: string;
      org?: boolean;
      variants?: string[];
      intent?: string;
    }> = [
      {
        canonical: "sac de sucre",
        language: "FR", scope: "GLOBAL", status: "VALIDATED",
        meaning: "Contenant standard de sucre vendu au détail ou en gros.",
        intent: "PRODUCT_AVAILABILITY",
        variants: ["sac sucre"],
      },
      {
        canonical: "carton de lait",
        language: "FR", scope: "DOMAIN", status: "VALIDATED",
        meaning: "Unité de conditionnement du lait en poudre.",
        intent: "PRODUCT_SEARCH",
      },
      {
        // exemple bambara déjà présent dans le projet (seed Phase 6B) — SUGGESTED,
        // en attente de validation humaine (on n'invente pas de vérité bambara).
        canonical: "sukaro",
        language: "BM", scope: "GLOBAL", status: "SUGGESTED",
        meaning: "Proposition : « sucre » (à valider).",
        fr: "sucre",
      },
      {
        canonical: "n b'a fɛ, ajoute-moi 2 cartons de lait",
        language: "MIXED", scope: "DOMAIN", status: "SUGGESTED",
        meaning: "Exemple de code-switching bambara/français dans un contexte de commande.",
      },
      {
        canonical: "gambiaka",
        language: "FR", scope: "ORGANIZATION", status: "VALIDATED",
        meaning: "Riz brisé Gambiaka 25 kg (référence interne de cette entreprise).",
        org: true,
      },
    ];

    if ((await prisma.languageEntry.count()) === 0) {
      for (const d of DEMO_ENTRIES) {
        let entry;
        try {
          entry = await prisma.languageEntry.create({
            data: {
              canonicalText: d.canonical,
              normalizedText: norm(d.canonical),
              language: d.language,
              scope: d.scope,
              domainCode: d.scope === "DOMAIN" ? commerce.code : null,
              organizationId: d.org ? org.id : null,
              meaning: d.meaning,
              frenchTranslation: d.fr ?? null,
              source: "RESEARCH",
              status: d.status,
              provenance: { demo: true, note: "DEV/DEMO — pas une référence linguistique officielle." },
              validatedByRef: d.status === "VALIDATED" ? "seed" : null,
              validatedAt: d.status === "VALIDATED" ? new Date() : null,
              version: 1,
            },
          });
        } catch {
          continue;
        }
        for (const v of d.variants ?? []) {
          await prisma.languageVariant.create({
            data: {
              languageEntryId: entry.id,
              text: v,
              normalizedText: norm(v),
              variantType: "SPELLING",
              status: d.status === "VALIDATED" ? "VALIDATED" : "SUGGESTED",
            },
          });
        }
        if (d.intent) {
          await prisma.languageIntentMapping.create({
            data: {
              languageEntryId: entry.id,
              intentCode: d.intent,
              domainCode: d.scope === "DOMAIN" ? commerce.code : null,
              status: d.status === "VALIDATED" ? "VALIDATED" : "SUGGESTED",
            },
          });
        }
        await prisma.languageEntryRevision.create({
          data: { languageEntryId: entry.id, version: 1, snapshot: { seeded: true }, changeReason: "seed" },
        });
      }
    }

    // ── Phase 6D : Learning Loop — corrections répétées (DEV/DEMO) + recompute ──
    if ((await prisma.languageCorrection.count()) === 0) {
      const { recomputeLearningCandidates } = await import(
        "../src/language-core/learning/aggregator.ts"
      );
      // 3 corrections identiques dans la SEULE organisation démo → candidat
      // proposé en ORGANIZATION (jamais DOMAIN/GLOBAL — §51).
      for (let i = 0; i < 3; i++) {
        const obs = await prisma.languageObservation.create({
          data: {
            applicationCode: "DJELI_BUSINESS",
            organizationId: org.id,
            domainCode: "commerce",
            originalText: "six saques sucre",
            normalizedText: "six saques sucre",
            detectedLanguage: "FR",
            contextType: "voice",
            resolvedMatchType: "NONE",
            status: "LINKED",
          },
        });
        await prisma.languageCorrection.create({
          data: {
            observationId: obs.id,
            originalText: "six saques sucre",
            correctedText: "six sacs de sucre",
            detectedLanguage: "FR",
            context: "voice-transcription-correction",
            consentStatus: "GRANTED",
            sanitizedText: "six sacs de sucre",
            correctedByRef: "user:seed",
          },
        });
      }
      // Une expression non reconnue vue plusieurs fois (signal no-match).
      for (let i = 0; i < 4; i++) {
        await prisma.languageObservation.create({
          data: {
            applicationCode: "DJELI_BUSINESS",
            organizationId: org.id,
            domainCode: "commerce",
            originalText: "aw be sugu la wa",
            normalizedText: "aw be sugu la wa",
            detectedLanguage: "BM",
            contextType: "chat",
            resolvedMatchType: "NONE",
            status: "NEW",
          },
        });
      }
      const rc = await recomputeLearningCandidates("seed");
      console.log(
        `  Learning   : ${rc.candidatesCreated} candidat(s) généré(s) (recompute idempotent)`,
      );
    }
  }

  // ─────────────── Phase 7 : automatisations + marketing ───────────────
  {
    const { runAutomationsForOrganization } = await import(
      "../src/server/automations/automation-service.ts"
    );
    // Crée le jeu de règles par défaut + lance une passe (détection réelle sur
    // les données seed). Aucune action externe : uniquement des recommandations.
    const pass = await runAutomationsForOrganization({
      organizationId: org.id,
      timezone: org.timezone,
      currency: org.currency,
      actorUserId: undefined,
      ignoreEnabled: true,
    });

    // Un client explicitement désinscrit du marketing (§29) — pour l'aperçu
    // d'audience qui doit l'exclure.
    const someCustomers = await prisma.customer.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "asc" },
      take: 3,
      select: { id: true },
    });
    if (someCustomers[2]) {
      await prisma.customer.update({
        where: { id: someCustomers[2].id },
        data: { marketingOptIn: false, marketingOptOutAt: new Date() },
      });
    }

    // Une campagne de réactivation en BROUILLON (jamais envoyée par le seed).
    if ((await prisma.marketingCampaign.count({ where: { organizationId: org.id } })) === 0) {
      const owner = await prisma.organizationMember.findFirst({
        where: { organizationId: org.id, role: "OWNER" },
        select: { userId: true },
      });
      const { createCampaign } = await import(
        "../src/server/marketing/campaign-service.ts"
      );
      if (owner) {
        await createCampaign({
          organizationId: org.id,
          actorUserId: owner.userId,
          name: "Réactivation grossistes (démo)",
          type: "CUSTOMER_REACTIVATION",
          audienceType: "INACTIVE_CUSTOMERS",
          audienceConfig: { inactiveDays: 45 },
          channel: "WHATSAPP",
        });
      }
    }

    console.log(
      `  Auto/Mktg  : ${pass.rulesRun} règle(s) analysée(s), ${pass.created} recommandation(s) + 1 campagne DRAFT`,
    );
  }

  // ─────────────── Phase 8 : production + monétisation + pilote ───────────────
  {
    const { getOrCreateSubscription, setSubscriptionStatus } = await import(
      "../src/server/billing/subscription-service.ts"
    );
    await getOrCreateSubscription(org.id, { planCode: "BUSINESS" });
    await setSubscriptionStatus({ organizationId: org.id, status: "ACTIVE", actorUserId: owner.id });

    // Organisation de démo + opérateur Djeli pour tester la console /admin.
    await prisma.organization.update({ where: { id: org.id }, data: { isDemo: true, isPilot: true } });
    await prisma.user.update({ where: { id: owner.id }, data: { isSuperAdmin: true } });

    console.log(
      `  SaaS       : offre BUSINESS ACTIVE · ${owner.email} opérateur Djeli (/admin) · org pilote+démo`,
    );
  }

  console.log("✓ Seed terminé.");
  console.log(
    `  Catalogue  : ${CATEGORIES.length} catégories, ${PRODUCTS.length} produits + mouvements`,
  );
  console.log(
    `  CRM        : ${CUSTOMERS.length} clients, 6 commandes (NEW, CONFIRMED, 4× DELIVERED)`,
  );
  console.log(
    `  Créances   : 1 soldée, 1 crédit à échoir, 2 en retard (dont 1 partielle) + 1 campagne de relance`,
  );
  console.log(
    `  WhatsApp   : connexion mock CONNECTED + 4 conversations (AUTO / HUMAIN / EN PAUSE, 1 fenêtre 24 h fermée)`,
  );
  console.log(
    `  Djeli IA   : échange sucre (Aminata) + 1 brouillon de commande « à valider » (6 × Sucre 50 kg)`,
  );
  console.log(
    `  Djeli Voice: 3 vocaux (Mariam) — FR corrigé, BM, MIXED FR/BM`,
  );
  console.log(
    `  Lang. Core : domaine commerce, app DJELI_BUSINESS (client djeli-business), 5 entrées DEV/DEMO`,
  );
  console.log(`  Entreprise : ${org.name} (${org.slug})`);
  console.log(`  Connexion  : moussa@djeli.demo / ${PASSWORD} (OWNER)`);
  console.log(`  Autres     : awa@ (ADMIN), ibrahim@ (MANAGER), fatou@ (SALES), oumar@ (EMPLOYEE)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
