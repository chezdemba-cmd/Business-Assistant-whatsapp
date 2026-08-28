import "server-only";
import type { OrderPaymentStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { todayRange } from "@/lib/tz";
import {
  agingBucketFor,
  balanceDue as calcBalanceDue,
  daysOverdue as calcDaysOverdue,
  isOrderOverdue,
  type AgingBucket,
} from "./payment-rules";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Couche de LECTURE des créances — agrégations dérivées d'Order + Payment.
 * Aucune table `Debt` : tout est recalculé ici (§11).
 *
 * Échelle MVP : le nombre de créances ouvertes par organisation reste modeste,
 * on charge l'ensemble borné puis on calcule tranches / retards en mémoire.
 * Dette technique documentée pour un volume important (colonne calculée ou
 * vue matérialisée).
 */

// ─────────────────────── Résumé par commande ───────────────────────

export type OrderPaymentSummary = {
  orderId: string;
  currency: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: OrderPaymentStatus;
  dueDate: Date | null;
  isOverdue: boolean;
  daysOverdue: number;
};

export async function getOrderPaymentSummary(
  organizationId: string,
  orderId: string,
  db: Db = prisma,
  now: Date = new Date(),
): Promise<OrderPaymentSummary | null> {
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId },
    select: {
      id: true,
      currency: true,
      status: true,
      totalAmount: true,
      amountPaid: true,
      paymentStatus: true,
      dueDate: true,
    },
  });
  if (!order) return null;

  const bal = calcBalanceDue(order.totalAmount, order.amountPaid);
  const overdue = isOrderOverdue(
    { status: order.status, balanceDue: bal, dueDate: order.dueDate },
    now,
  );
  return {
    orderId: order.id,
    currency: order.currency,
    totalAmount: order.totalAmount,
    amountPaid: order.amountPaid,
    balanceDue: bal,
    paymentStatus: order.paymentStatus,
    dueDate: order.dueDate,
    isOverdue: overdue,
    daysOverdue:
      order.dueDate && bal > 0 ? Math.max(0, calcDaysOverdue(order.dueDate, now)) : 0,
  };
}

// ─────────────────────── Résumé financier client ───────────────────────

export type CustomerFinancialSummary = {
  totalPurchased: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueOutstanding: number;
  unpaidOrdersCount: number;
  oldestDueDate: Date | null;
};

const EMPTY_FIN: CustomerFinancialSummary = {
  totalPurchased: 0,
  totalPaid: 0,
  totalOutstanding: 0,
  overdueOutstanding: 0,
  unpaidOrdersCount: 0,
  oldestDueDate: null,
};

export async function getCustomerFinancialSummaryMany(
  organizationId: string,
  customerIds: string[],
  db: Db = prisma,
  now: Date = new Date(),
): Promise<Map<string, CustomerFinancialSummary>> {
  const map = new Map<string, CustomerFinancialSummary>();
  if (customerIds.length === 0) return map;
  for (const id of customerIds) map.set(id, { ...EMPTY_FIN });

  const orders = await db.order.findMany({
    where: {
      organizationId,
      customerId: { in: customerIds },
      status: "DELIVERED",
    },
    select: {
      customerId: true,
      totalAmount: true,
      amountPaid: true,
      dueDate: true,
      status: true,
    },
  });

  for (const o of orders) {
    const s = map.get(o.customerId);
    if (!s) continue;
    s.totalPurchased += o.totalAmount;
    s.totalPaid += o.amountPaid;
    const bal = calcBalanceDue(o.totalAmount, o.amountPaid);
    if (bal > 0) {
      s.totalOutstanding += bal;
      s.unpaidOrdersCount += 1;
      if (o.dueDate && (!s.oldestDueDate || o.dueDate < s.oldestDueDate)) {
        s.oldestDueDate = o.dueDate;
      }
      if (
        isOrderOverdue(
          { status: o.status, balanceDue: bal, dueDate: o.dueDate },
          now,
        )
      ) {
        s.overdueOutstanding += bal;
      }
    }
  }
  return map;
}

export async function getCustomerFinancialSummary(
  organizationId: string,
  customerId: string,
  db: Db = prisma,
  now: Date = new Date(),
): Promise<CustomerFinancialSummary> {
  const map = await getCustomerFinancialSummaryMany(
    organizationId,
    [customerId],
    db,
    now,
  );
  return map.get(customerId) ?? { ...EMPTY_FIN };
}

// ─────────────────────── Liste des créances ───────────────────────

export type DebtRow = {
  orderId: string;
  reference: string;
  createdAt: Date;
  customerId: string;
  customerName: string;
  currency: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: Date | null;
  daysOverdue: number;
  isOverdue: boolean;
  bucket: AgingBucket;
  paymentStatus: OrderPaymentStatus;
};

export type DebtFilters = {
  customerId?: string;
  /** Recherche libre sur le nom du client ou la référence de commande. */
  search?: string;
  onlyOverdue?: boolean;
  bucket?: AgingBucket;
  minAmount?: number;
  maxAmount?: number;
  /** Filtre sur la date d'échéance. */
  dueFrom?: Date;
  dueTo?: Date;
};

/**
 * Toutes les créances recouvrables (§12 : commande LIVRÉE + solde > 0),
 * dérivées puis filtrées / paginées en mémoire.
 */
export async function listDebts(
  organizationId: string,
  opts: {
    scopeWhere?: Prisma.OrderWhereInput;
    filters?: DebtFilters;
    page?: number;
    pageSize?: number;
    now?: Date;
  } = {},
): Promise<{ rows: DebtRow[]; total: number; page: number; pageSize: number }> {
  const now = opts.now ?? new Date();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const f = opts.filters ?? {};

  const orders = await prisma.order.findMany({
    where: {
      organizationId,
      status: "DELIVERED",
      paymentStatus: { not: "PAID" },
      ...(f.customerId ? { customerId: f.customerId } : {}),
      ...(opts.scopeWhere ?? {}),
    },
    select: {
      id: true,
      reference: true,
      createdAt: true,
      currency: true,
      totalAmount: true,
      amountPaid: true,
      dueDate: true,
      paymentStatus: true,
      customer: { select: { id: true, displayName: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  let rows: DebtRow[] = orders
    .map((o) => {
      const bal = calcBalanceDue(o.totalAmount, o.amountPaid);
      const overdue = isOrderOverdue(
        { status: "DELIVERED", balanceDue: bal, dueDate: o.dueDate },
        now,
      );
      return {
        orderId: o.id,
        reference: o.reference,
        createdAt: o.createdAt,
        customerId: o.customer.id,
        customerName: o.customer.displayName,
        currency: o.currency,
        totalAmount: o.totalAmount,
        amountPaid: o.amountPaid,
        balanceDue: bal,
        dueDate: o.dueDate,
        daysOverdue: o.dueDate ? Math.max(0, calcDaysOverdue(o.dueDate, now)) : 0,
        isOverdue: overdue,
        bucket: agingBucketFor(o.dueDate, now),
        paymentStatus: o.paymentStatus,
      };
    })
    .filter((r) => r.balanceDue > 0);

  if (f.search) {
    const needle = f.search.trim().toLowerCase();
    if (needle) {
      rows = rows.filter(
        (r) =>
          r.customerName.toLowerCase().includes(needle) ||
          r.reference.toLowerCase().includes(needle),
      );
    }
  }
  if (f.onlyOverdue) rows = rows.filter((r) => r.isOverdue);
  if (f.bucket) rows = rows.filter((r) => r.bucket === f.bucket);
  if (typeof f.minAmount === "number") {
    rows = rows.filter((r) => r.balanceDue >= f.minAmount!);
  }
  if (typeof f.maxAmount === "number") {
    rows = rows.filter((r) => r.balanceDue <= f.maxAmount!);
  }
  if (f.dueFrom) {
    rows = rows.filter((r) => r.dueDate != null && r.dueDate >= f.dueFrom!);
  }
  if (f.dueTo) {
    rows = rows.filter((r) => r.dueDate != null && r.dueDate <= f.dueTo!);
  }

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
}

// ─────────────────────── Vue d'ensemble des créances ───────────────────────

export type DebtsOverview = {
  totalOutstanding: number;
  overdueOutstanding: number;
  notDueOutstanding: number;
  debtorCount: number;
  orderCount: number;
  oldestDueDate: Date | null;
  buckets: Record<AgingBucket, { amount: number; count: number }>;
};

function emptyBuckets(): DebtsOverview["buckets"] {
  return {
    NOT_DUE: { amount: 0, count: 0 },
    D1_7: { amount: 0, count: 0 },
    D8_30: { amount: 0, count: 0 },
    D31_60: { amount: 0, count: 0 },
    D61_90: { amount: 0, count: 0 },
    D90_PLUS: { amount: 0, count: 0 },
  };
}

export async function getDebtsOverview(
  organizationId: string,
  opts: { scopeWhere?: Prisma.OrderWhereInput; now?: Date } = {},
): Promise<DebtsOverview> {
  const now = opts.now ?? new Date();
  const orders = await prisma.order.findMany({
    where: {
      organizationId,
      status: "DELIVERED",
      paymentStatus: { not: "PAID" },
      ...(opts.scopeWhere ?? {}),
    },
    select: {
      customerId: true,
      totalAmount: true,
      amountPaid: true,
      dueDate: true,
    },
  });

  const out: DebtsOverview = {
    totalOutstanding: 0,
    overdueOutstanding: 0,
    notDueOutstanding: 0,
    debtorCount: 0,
    orderCount: 0,
    oldestDueDate: null,
    buckets: emptyBuckets(),
  };
  const debtors = new Set<string>();

  for (const o of orders) {
    const bal = calcBalanceDue(o.totalAmount, o.amountPaid);
    if (bal <= 0) continue;
    out.totalOutstanding += bal;
    out.orderCount += 1;
    debtors.add(o.customerId);

    const overdue = isOrderOverdue(
      { status: "DELIVERED", balanceDue: bal, dueDate: o.dueDate },
      now,
    );
    if (overdue) {
      out.overdueOutstanding += bal;
      if (o.dueDate && (!out.oldestDueDate || o.dueDate < out.oldestDueDate)) {
        out.oldestDueDate = o.dueDate;
      }
    } else {
      out.notDueOutstanding += bal;
    }

    const bucket = agingBucketFor(o.dueDate, now);
    out.buckets[bucket].amount += bal;
    out.buckets[bucket].count += 1;
  }

  out.debtorCount = debtors.size;
  return out;
}

/** Tuile dashboard « Créances en retard » (§28). */
export async function getOverdueDebtsSummary(
  organizationId: string,
  opts: { scopeWhere?: Prisma.OrderWhereInput; now?: Date } = {},
): Promise<{ amount: number; customerCount: number; orderCount: number }> {
  const now = opts.now ?? new Date();
  const orders = await prisma.order.findMany({
    where: {
      organizationId,
      status: "DELIVERED",
      paymentStatus: { not: "PAID" },
      dueDate: { lt: now },
      ...(opts.scopeWhere ?? {}),
    },
    select: { customerId: true, totalAmount: true, amountPaid: true },
  });

  let amount = 0;
  let orderCount = 0;
  const customers = new Set<string>();
  for (const o of orders) {
    const bal = calcBalanceDue(o.totalAmount, o.amountPaid);
    if (bal <= 0) continue;
    amount += bal;
    orderCount += 1;
    customers.add(o.customerId);
  }
  return { amount, customerCount: customers.size, orderCount };
}

/** Encaissements confirmés du jour dans le fuseau de l'organisation (§28). */
export async function getCashCollectedToday(
  organizationId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<{ amount: number; count: number }> {
  const { gte, lt } = todayRange(timeZone, now);
  const agg = await prisma.payment.aggregate({
    where: {
      organizationId,
      status: "CONFIRMED",
      paidAt: { gte, lt },
    },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return { amount: agg._sum.amount ?? 0, count: agg._count._all };
}
