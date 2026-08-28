import "server-only";
import type { AutomationRuleType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { formatAmount, formatInt } from "@/lib/format";
import { getStockSnapshots } from "@/server/stock/stock-service";
import { listDebts } from "@/server/finance/finance-service";
import { balanceDue as calcBalanceDue } from "@/server/finance/payment-rules";
import { dayPeriodKey } from "./recommendation-key";
import {
  configNumber,
  effectiveRuleConfig,
  type RuleConfig,
} from "./rules";
import {
  inactiveCustomerPriority,
  orderPendingPriority,
  orderStuckPriority,
  overdueDebtPriority,
  paymentDueSoonPriority,
  stockPriority,
} from "./priority";
import {
  daysBetween,
  isSalesOpportunity,
  typicalIntervalDays,
} from "./inactivity";
import { buildDailyDigest } from "./daily-digest";
import type { DetectedRecommendation } from "./recommendation-service";

/**
 * Détecteurs — un par type de règle. Chacun lit les VRAIS services métier
 * (§8 stock, §10 finance) et renvoie des recommandations candidates. Aucun
 * détecteur n'exécute d'action : il décrit un fait.
 */

export type DetectContext = {
  organizationId: string;
  timezone: string;
  currency: string;
  now: Date;
  config: RuleConfig;
};

type Detector = (ctx: DetectContext) => Promise<DetectedRecommendation[]>;

const money = (n: number, c: string) => formatAmount(n, c);

// ─────────────────────────── Stock ───────────────────────────

async function loadStockStates(organizationId: string) {
  const products = await prisma.product.findMany({
    where: { organizationId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, sku: true, alertThreshold: true, purchasePrice: true },
  });
  const snaps = await getStockSnapshots(organizationId, products);
  return products.map((p) => ({ product: p, snap: snaps.get(p.id)! })).filter((x) => x.snap);
}

const detectLowStock: Detector = async (ctx) => {
  const cooldownHours = configNumber(ctx.config, "cooldownHours", 24);
  const rows = await loadStockStates(ctx.organizationId);
  return rows
    .filter((x) => x.snap.state === "LOW_STOCK")
    .map(({ product, snap }) => ({
      type: "LOW_STOCK" as const,
      title: `Stock faible : ${product.name}`,
      description: `Il reste ${formatInt(snap.available)} en stock disponible de « ${product.name} » (seuil d'alerte : ${formatInt(product.alertThreshold)}). Pensez à réapprovisionner.`,
      priority: stockPriority(snap.available),
      entityType: "product",
      entityId: product.id,
      actionType: "OPEN_PRODUCT" as const,
      actionPayload: { productId: product.id },
      facts: { available: snap.available, reserved: snap.reserved, alertThreshold: product.alertThreshold, sku: product.sku },
      cooldownHours,
    }));
};

const detectOutOfStock: Detector = async (ctx) => {
  const cooldownHours = configNumber(ctx.config, "cooldownHours", 12);
  const rows = await loadStockStates(ctx.organizationId);
  return rows
    .filter((x) => x.snap.state === "OUT_OF_STOCK")
    .map(({ product, snap }) => ({
      type: "OUT_OF_STOCK" as const,
      title: `Rupture : ${product.name}`,
      description: `« ${product.name} » est en rupture (${formatInt(snap.available)} disponible). Réapprovisionnez ou retirez-le du catalogue le temps du réassort.`,
      priority: stockPriority(snap.available),
      entityType: "product",
      entityId: product.id,
      actionType: "OPEN_PRODUCT" as const,
      actionPayload: { productId: product.id },
      facts: { available: snap.available, reserved: snap.reserved, sku: product.sku },
      cooldownHours,
    }));
};

// ─────────────────────────── Créances ───────────────────────────

async function assigneeByCustomer(organizationId: string, customerIds: string[]) {
  const map = new Map<string, string | null>();
  if (customerIds.length === 0) return map;
  const rows = await prisma.customer.findMany({
    where: { organizationId, id: { in: customerIds } },
    select: { id: true, assignedToUserId: true },
  });
  for (const r of rows) map.set(r.id, r.assignedToUserId);
  return map;
}

const detectOverdueDebt: Detector = async (ctx) => {
  const minDays = configNumber(ctx.config, "minDaysOverdue", 7);
  const cooldownHours = configNumber(ctx.config, "cooldownHours", 48);
  const { rows } = await listDebts(ctx.organizationId, {
    filters: { onlyOverdue: true },
    page: 1,
    pageSize: 100,
    now: ctx.now,
  });
  const overdue = rows.filter((r) => r.daysOverdue >= minDays);
  const assignees = await assigneeByCustomer(
    ctx.organizationId,
    [...new Set(overdue.map((r) => r.customerId))],
  );
  return overdue.map((r) => ({
    type: "OVERDUE_DEBT" as const,
    title: `Créance en retard : ${r.customerName}`,
    description: `${r.customerName} doit ${money(r.balanceDue, r.currency)} sur la commande ${r.reference}, en retard de ${formatInt(r.daysOverdue)} jour(s). Préparez une relance.`,
    priority: overdueDebtPriority(r.daysOverdue, r.balanceDue),
    entityType: "order",
    entityId: r.orderId,
    actionType: "PREPARE_REMINDER" as const,
    actionPayload: { customerId: r.customerId, orderId: r.orderId },
    facts: { balanceDue: r.balanceDue, daysOverdue: r.daysOverdue, bucket: r.bucket, reference: r.reference },
    ownerUserId: assignees.get(r.customerId) ?? null,
    cooldownHours,
  }));
};

const detectPaymentDueSoon: Detector = async (ctx) => {
  const daysBefore = configNumber(ctx.config, "daysBefore", 3);
  const cooldownHours = configNumber(ctx.config, "cooldownHours", 48);
  const horizon = new Date(ctx.now.getTime() + daysBefore * 86_400_000);
  const orders = await prisma.order.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "DELIVERED",
      paymentStatus: { not: "PAID" },
      dueDate: { gte: ctx.now, lte: horizon },
    },
    select: {
      id: true, reference: true, currency: true, totalAmount: true, amountPaid: true,
      dueDate: true, customerId: true,
      customer: { select: { displayName: true, assignedToUserId: true } },
    },
  });
  const out: DetectedRecommendation[] = [];
  for (const o of orders) {
    const bal = calcBalanceDue(o.totalAmount, o.amountPaid);
    if (bal <= 0) continue;
    const days = Math.max(0, daysBetween(ctx.now, o.dueDate!));
    out.push({
      type: "PAYMENT_DUE_SOON",
      title: `Échéance proche : ${o.customer.displayName}`,
      description: `La créance de ${o.customer.displayName} (${money(bal, o.currency)}, commande ${o.reference}) arrive à échéance dans ${formatInt(days)} jour(s).`,
      priority: paymentDueSoonPriority(bal),
      entityType: "order",
      entityId: o.id,
      actionType: "PREPARE_REMINDER",
      actionPayload: { customerId: o.customerId, orderId: o.id },
      facts: { balanceDue: bal, daysUntilDue: days, reference: o.reference },
      ownerUserId: o.customer.assignedToUserId ?? null,
      cooldownHours,
    });
  }
  return out;
};

// ─────────────────────────── Clients ───────────────────────────

const detectInactiveCustomers: Detector = async (ctx) => {
  const thresholdDays = configNumber(ctx.config, "thresholdDays", 60);
  const cooldownHours = configNumber(ctx.config, "cooldownHours", 168);
  const cutoff = new Date(ctx.now.getTime() - thresholdDays * 86_400_000);

  // Clients ACTIVE ayant déjà une commande livrée, mais aucune depuis le seuil.
  const candidates = await prisma.customer.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      orders: { some: { status: "DELIVERED" } },
    },
    select: {
      id: true,
      displayName: true,
      orders: {
        where: { status: "DELIVERED" },
        orderBy: { deliveredAt: "desc" },
        take: 1,
        select: { deliveredAt: true },
      },
    },
  });
  const inactive = candidates.filter((c) => {
    const last = c.orders[0]?.deliveredAt ?? null;
    return last != null && last < cutoff;
  });
  if (inactive.length === 0) return [];

  // Recommandation AGRÉGÉE (§12) — une seule, rafraîchie à chaque passe.
  return [
    {
      type: "INACTIVE_CUSTOMER" as const,
      title: `${formatInt(inactive.length)} client(s) inactif(s)`,
      description: `${formatInt(inactive.length)} client(s) n'ont pas passé de commande depuis plus de ${formatInt(thresholdDays)} jours. Préparez une campagne de réactivation.`,
      priority: inactiveCustomerPriority(thresholdDays),
      entityType: "segment",
      entityId: null,
      actionType: "PREPARE_CAMPAIGN" as const,
      actionPayload: { audienceType: "INACTIVE_CUSTOMERS", inactiveDays: thresholdDays },
      facts: {
        count: inactive.length,
        thresholdDays,
        sample: inactive.slice(0, 8).map((c) => c.displayName),
      },
      cooldownHours,
    },
  ];
};

const detectSalesOpportunity: Detector = async (ctx) => {
  const overdueFactor = configNumber(ctx.config, "overdueFactor", 1.5);
  const cooldownHours = configNumber(ctx.config, "cooldownHours", 168);
  const lookback = new Date(ctx.now.getTime() - 365 * 86_400_000);

  const customers = await prisma.customer.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      orders: { some: { status: "DELIVERED", deliveredAt: { gte: lookback } } },
    },
    take: 500,
    select: {
      id: true,
      displayName: true,
      assignedToUserId: true,
      orders: {
        where: { status: "DELIVERED", deliveredAt: { not: null } },
        orderBy: { deliveredAt: "desc" },
        select: { deliveredAt: true },
      },
    },
  });

  const out: DetectedRecommendation[] = [];
  for (const c of customers) {
    const dates = c.orders.map((o) => o.deliveredAt!).filter(Boolean);
    if (dates.length < 3) continue;
    const interval = typicalIntervalDays(dates);
    const last = dates[0]!;
    if (
      isSalesOpportunity({
        lastDeliveredAt: last,
        typicalIntervalDays: interval,
        orderCount: dates.length,
        now: ctx.now,
        overdueFactor,
      })
    ) {
      const gap = daysBetween(last, ctx.now);
      out.push({
        type: "SALES_OPPORTUNITY",
        title: `Opportunité : ${c.displayName}`,
        description: `${c.displayName} commande d'habitude tous les ${formatInt(interval!)} jours environ, mais rien depuis ${formatInt(gap)} jours. Un petit rappel peut relancer la commande.`,
        priority: "LOW",
        entityType: "customer",
        entityId: c.id,
        actionType: "OPEN_CUSTOMER",
        actionPayload: { customerId: c.id },
        facts: { typicalIntervalDays: interval, daysSinceLastOrder: gap, orderCount: dates.length },
        ownerUserId: c.assignedToUserId ?? null,
        cooldownHours,
      });
    }
  }
  return out;
};

// ─────────────────────────── Commandes ───────────────────────────

const detectOrderPending: Detector = async (ctx) => {
  const hours = configNumber(ctx.config, "hours", 2);
  const cooldownHours = configNumber(ctx.config, "cooldownHours", 6);
  const cutoff = new Date(ctx.now.getTime() - hours * 3_600_000);
  const orders = await prisma.order.findMany({
    where: { organizationId: ctx.organizationId, status: "PENDING_CONFIRMATION", createdAt: { lt: cutoff } },
    select: {
      id: true, reference: true, createdAt: true, createdByUserId: true,
      customer: { select: { displayName: true, assignedToUserId: true } },
    },
  });
  return orders.map((o) => {
    const waited = Math.max(0, Math.round((ctx.now.getTime() - o.createdAt.getTime()) / 3_600_000));
    return {
      type: "ORDER_PENDING_CONFIRMATION" as const,
      title: `Commande à confirmer : ${o.reference}`,
      description: `La commande ${o.reference} de ${o.customer.displayName} attend une confirmation depuis ${formatInt(waited)} h.`,
      priority: orderPendingPriority(waited),
      entityType: "order",
      entityId: o.id,
      actionType: "OPEN_ORDER" as const,
      actionPayload: { orderId: o.id },
      facts: { hoursWaiting: waited, reference: o.reference },
      ownerUserId: o.createdByUserId ?? o.customer.assignedToUserId ?? null,
      cooldownHours,
    };
  });
};

const detectOrderStuck: Detector = async (ctx) => {
  const hours = configNumber(ctx.config, "hours", 48);
  const cooldownHours = configNumber(ctx.config, "cooldownHours", 24);
  const cutoff = new Date(ctx.now.getTime() - hours * 3_600_000);
  const orders = await prisma.order.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: { in: ["PREPARING", "OUT_FOR_DELIVERY"] },
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true, reference: true, status: true, updatedAt: true, createdByUserId: true,
      customer: { select: { displayName: true, assignedToUserId: true } },
    },
  });
  return orders.map((o) => {
    const stuck = Math.max(0, Math.round((ctx.now.getTime() - o.updatedAt.getTime()) / 3_600_000));
    const label = o.status === "PREPARING" ? "en préparation" : "en livraison";
    return {
      type: "ORDER_STUCK" as const,
      title: `Commande bloquée : ${o.reference}`,
      description: `La commande ${o.reference} de ${o.customer.displayName} est ${label} depuis ${formatInt(stuck)} h sans changement de statut.`,
      priority: orderStuckPriority(stuck),
      entityType: "order",
      entityId: o.id,
      actionType: "OPEN_ORDER" as const,
      actionPayload: { orderId: o.id },
      facts: { hoursStuck: stuck, status: o.status, reference: o.reference },
      ownerUserId: o.createdByUserId ?? o.customer.assignedToUserId ?? null,
      cooldownHours,
    };
  });
};

const detectOrdersToPrepare: Detector = async (ctx) => {
  const cooldownHours = configNumber(ctx.config, "cooldownHours", 6);
  const count = await prisma.order.count({
    where: { organizationId: ctx.organizationId, status: "CONFIRMED" },
  });
  if (count === 0) return [];
  return [
    {
      type: "ORDER_TO_PREPARE" as const,
      title: `${formatInt(count)} commande(s) à préparer`,
      description: `${formatInt(count)} commande(s) confirmée(s) attendent d'être préparées.`,
      priority: count >= 10 ? "HIGH" : "MEDIUM",
      entityType: "segment",
      entityId: null,
      actionType: "OPEN_ORDER" as const,
      actionPayload: { filter: "CONFIRMED" },
      facts: { count },
      cooldownHours,
    },
  ];
};

// ─────────────────────────── Résumé quotidien ───────────────────────────

const detectDailySummary: Detector = async (ctx) => {
  const digest = await buildDailyDigest(ctx.organizationId, {
    timezone: ctx.timezone,
    currency: ctx.currency,
    now: ctx.now,
  });
  const period = dayPeriodKey(ctx.now, ctx.timezone);
  const parts = [
    `${money(digest.salesToday, ctx.currency)} vendus`,
    `${money(digest.cashCollectedToday, ctx.currency)} encaissés`,
    `${formatInt(digest.ordersCreatedToday)} commande(s)`,
    `${formatInt(digest.newCustomersToday)} nouveau(x) client(s)`,
  ];
  const watch: string[] = [];
  if (digest.overdueDebtCustomers > 0) {
    watch.push(`${formatInt(digest.overdueDebtCustomers)} créance(s) à relancer (${money(digest.overdueDebtAmount, ctx.currency)})`);
  }
  if (digest.outOfStockCount > 0) watch.push(`${formatInt(digest.outOfStockCount)} rupture(s)`);
  if (digest.lowStockCount > 0) watch.push(`${formatInt(digest.lowStockCount)} stock(s) faible(s)`);
  if (digest.ordersToPrepare > 0) watch.push(`${formatInt(digest.ordersToPrepare)} commande(s) à traiter`);

  return [
    {
      type: "DAILY_SUMMARY" as const,
      title: `Résumé du ${digest.day}`,
      description:
        `Aujourd'hui : ${parts.join(", ")}.` +
        (watch.length ? ` À surveiller : ${watch.join(", ")}.` : " Rien de particulier à surveiller."),
      priority: "LOW",
      entityType: "day",
      entityId: null,
      periodKey: period,
      facts: digest,
      cooldownHours: 0,
    },
  ];
};

// ─────────────────────────── Registre ───────────────────────────

export const DETECTORS: Record<
  Extract<
    AutomationRuleType,
    | "LOW_STOCK" | "OUT_OF_STOCK" | "OVERDUE_DEBT" | "PAYMENT_DUE_SOON"
    | "INACTIVE_CUSTOMER" | "SALES_OPPORTUNITY" | "ORDER_PENDING_CONFIRMATION"
    | "ORDER_STUCK" | "ORDER_TO_PREPARE" | "DAILY_SUMMARY"
  >,
  Detector
> = {
  LOW_STOCK: detectLowStock,
  OUT_OF_STOCK: detectOutOfStock,
  OVERDUE_DEBT: detectOverdueDebt,
  PAYMENT_DUE_SOON: detectPaymentDueSoon,
  INACTIVE_CUSTOMER: detectInactiveCustomers,
  SALES_OPPORTUNITY: detectSalesOpportunity,
  ORDER_PENDING_CONFIRMATION: detectOrderPending,
  ORDER_STUCK: detectOrderStuck,
  ORDER_TO_PREPARE: detectOrdersToPrepare,
  DAILY_SUMMARY: detectDailySummary,
};

export function detectorConfigFor(type: AutomationRuleType, stored: unknown): RuleConfig {
  return effectiveRuleConfig(type, stored);
}
