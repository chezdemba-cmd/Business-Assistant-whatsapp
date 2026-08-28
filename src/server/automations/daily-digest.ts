import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { todayRange } from "@/lib/tz";
import { getStockSummary } from "@/server/stock/stock-service";
import {
  getOverdueDebtsSummary,
  getCashCollectedToday,
} from "@/server/finance/finance-service";

/**
 * Résumé quotidien de l'entreprise (§16, §43). TOUS les chiffres proviennent
 * des services métier — jamais du LLM (§18, §45). Calculé dans le fuseau de
 * l'organisation.
 */

export type DailyDigest = {
  day: string; // YYYY-MM-DD (fuseau org)
  timezone: string;
  currency: string;
  salesToday: number;
  cashCollectedToday: number;
  ordersCreatedToday: number;
  newCustomersToday: number;
  overdueDebtAmount: number;
  overdueDebtCustomers: number;
  lowStockCount: number;
  outOfStockCount: number;
  ordersToPrepare: number;
  ordersPendingConfirmation: number;
};

const OPEN_TO_PREPARE = ["CONFIRMED", "PREPARING"] as const;

export async function buildDailyDigest(
  organizationId: string,
  opts: { timezone: string; currency: string; now?: Date; scopeWhere?: Prisma.OrderWhereInput } = {
    timezone: "Africa/Bamako",
    currency: "XOF",
  },
): Promise<DailyDigest> {
  const now = opts.now ?? new Date();
  const { gte, lt } = todayRange(opts.timezone, now);
  const scope = opts.scopeWhere ?? {};

  const [
    salesAgg,
    ordersCreated,
    newCustomers,
    stock,
    overdue,
    cash,
    toPrepare,
    pendingConfirm,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { organizationId, status: "DELIVERED", deliveredAt: { gte, lt }, ...scope },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({ where: { organizationId, createdAt: { gte, lt }, ...scope } }),
    prisma.customer.count({ where: { organizationId, createdAt: { gte, lt } } }),
    getStockSummary(organizationId),
    getOverdueDebtsSummary(organizationId, { now, scopeWhere: scope }),
    getCashCollectedToday(organizationId, opts.timezone, now),
    prisma.order.count({
      where: { organizationId, status: { in: [...OPEN_TO_PREPARE] }, ...scope },
    }),
    prisma.order.count({
      where: { organizationId, status: "PENDING_CONFIRMATION", ...scope },
    }),
  ]);

  return {
    day: new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTz(opts.timezone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now),
    timezone: opts.timezone,
    currency: opts.currency,
    salesToday: salesAgg._sum.totalAmount ?? 0,
    cashCollectedToday: cash.amount,
    ordersCreatedToday: ordersCreated,
    newCustomersToday: newCustomers,
    overdueDebtAmount: overdue.amount,
    overdueDebtCustomers: overdue.customerCount,
    lowStockCount: stock.lowStock,
    outOfStockCount: stock.outOfStock,
    ordersToPrepare: toPrepare,
    ordersPendingConfirmation: pendingConfirm,
  };
}

function safeTz(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}
