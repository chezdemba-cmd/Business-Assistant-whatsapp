import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import type { Permission } from "@/server/rbac/permissions";
import { orderScopeWhere, customerScopeWhere } from "@/server/crm/scope";
import {
  getStockSnapshots,
  getStockSnapshot,
} from "@/server/stock/stock-service";
import {
  getDebtsOverview,
  getCustomerFinancialSummary,
  getCashCollectedToday,
} from "@/server/finance/finance-service";
import { todayRange } from "@/lib/tz";
import { toE164OrNull } from "@/lib/identifiers";
import { type AiPrincipal, principalCan } from "./principal";
import type { AiToolName } from "./schema";

/**
 * COUCHE DE CAPACITÉS CONTRÔLÉES. L'IA n'appelle jamais Prisma : elle demande
 * un `toolName` de la liste blanche, avec des `args` validés. Chaque capacité
 * est tenant-scopée (organizationId vient du CONTEXTE, jamais des args) et
 * RBAC-scopée (permission + périmètre SALES + restriction SYSTEM_AI).
 */

export type CapabilityContext = {
  organizationId: string;
  organization: { currency: string; timezone: string; name: string };
  principal: AiPrincipal;
};

export type CapabilityResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: "UNKNOWN_TOOL" | "FORBIDDEN" | "BAD_ARGS" | "ERROR"; message: string };

function currencyLabel(currency: string): string {
  return currency === "XOF" || currency === "XAF" ? "FCFA" : currency;
}

/** SYSTEM_AI ne voit QUE le client de la conversation. */
function systemAiCustomerGuard(
  principal: AiPrincipal,
  customerId: string,
): boolean {
  if (principal.kind !== "SYSTEM_AI") return true;
  return principal.conversationCustomerId === customerId;
}

type Capability = {
  permission: Permission;
  args: z.ZodTypeAny;
  run: (ctx: CapabilityContext, args: unknown) => Promise<Record<string, unknown>>;
};

const CAPABILITIES: Record<AiToolName, Capability> = {
  searchProducts: {
    permission: "catalog.read",
    args: z.object({ query: z.string().trim().max(80).default("") }),
    async run(ctx, raw) {
      const { query } = raw as { query: string };
      const products = await prisma.product.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: "ACTIVE",
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { sku: { contains: query, mode: "insensitive" } },
                  { barcode: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { name: "asc" },
        take: 6,
      });
      const snaps = await getStockSnapshots(
        ctx.organizationId,
        products.map((p) => ({
          id: p.id,
          alertThreshold: p.alertThreshold,
          purchasePrice: p.purchasePrice,
        })),
      );
      return {
        matches: products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          salePrice: p.salePrice,
          available: snaps.get(p.id)?.available ?? 0,
          currencyLabel: currencyLabel(ctx.organization.currency),
        })),
      };
    },
  },

  getProductAvailability: {
    permission: "catalog.read",
    args: z.object({ productId: z.string().min(1) }),
    async run(ctx, raw) {
      const { productId } = raw as { productId: string };
      const p = await prisma.product.findFirst({
        where: { id: productId, organizationId: ctx.organizationId },
      });
      if (!p) return { found: false };
      const s = await getStockSnapshot(ctx.organizationId, {
        id: p.id,
        alertThreshold: p.alertThreshold,
        purchasePrice: p.purchasePrice,
      });
      return {
        found: true,
        id: p.id,
        name: p.name,
        salePrice: p.salePrice,
        physical: s.physical,
        reserved: s.reserved,
        available: s.available,
        currencyLabel: currencyLabel(ctx.organization.currency),
      };
    },
  },

  getCustomerByPhone: {
    permission: "customers.read",
    args: z.object({ phone: z.string().trim().min(4).max(24) }),
    async run(ctx, raw) {
      const { phone } = raw as { phone: string };
      const e164 = toE164OrNull(phone) ?? phone;
      const c = await prisma.customer.findFirst({
        where: { organizationId: ctx.organizationId, phone: e164 },
        select: { id: true, displayName: true, phone: true, customerType: true },
      });
      if (!c) return { found: false };
      if (!systemAiCustomerGuard(ctx.principal, c.id)) {
        return { found: false, restricted: true };
      }
      return { found: true, customer: c };
    },
  },

  searchCustomers: {
    permission: "customers.read",
    args: z.object({ query: z.string().trim().min(1).max(60) }),
    async run(ctx, raw) {
      if (ctx.principal.kind === "SYSTEM_AI") {
        // L'IA WhatsApp ne parcourt pas le carnet clients.
        return { matches: [], restricted: true };
      }
      const { query } = raw as { query: string };
      const scope = customerScopeWhere(ctx.principal.role, ctx.principal.userId);
      const rows = await prisma.customer.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...scope,
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { businessName: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
          ],
        },
        orderBy: { displayName: "asc" },
        take: 6,
        select: { id: true, displayName: true, phone: true },
      });
      return { matches: rows };
    },
  },

  getCustomerFinancialSummary: {
    permission: "debts.read",
    args: z.object({ customerId: z.string().min(1) }),
    async run(ctx, raw) {
      const { customerId } = raw as { customerId: string };
      if (!systemAiCustomerGuard(ctx.principal, customerId)) {
        return { found: false, restricted: true };
      }
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId: ctx.organizationId },
        select: { id: true, displayName: true, assignedToUserId: true },
      });
      if (!customer) return { found: false };
      if (
        ctx.principal.kind === "USER" &&
        ctx.principal.role === "SALES" &&
        customer.assignedToUserId !== ctx.principal.userId
      ) {
        return { found: false, restricted: true };
      }
      const fin = await getCustomerFinancialSummary(
        ctx.organizationId,
        customer.id,
      );
      return {
        found: true,
        customerName: customer.displayName,
        totalPurchased: fin.totalPurchased,
        totalPaid: fin.totalPaid,
        totalOutstanding: fin.totalOutstanding,
        overdueOutstanding: fin.overdueOutstanding,
        unpaidOrdersCount: fin.unpaidOrdersCount,
        currencyLabel: currencyLabel(ctx.organization.currency),
      };
    },
  },

  listCustomerOrders: {
    permission: "orders.read",
    args: z.object({
      customerId: z.string().min(1),
      limit: z.number().int().min(1).max(20).default(5),
    }),
    async run(ctx, raw) {
      const { customerId, limit } = raw as { customerId: string; limit: number };
      if (!systemAiCustomerGuard(ctx.principal, customerId)) {
        return { orders: [], restricted: true };
      }
      const scope =
        ctx.principal.kind === "USER"
          ? orderScopeWhere(ctx.principal.role, ctx.principal.userId)
          : {};
      const orders = await prisma.order.findMany({
        where: { organizationId: ctx.organizationId, customerId, ...scope },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          reference: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true,
        },
      });
      return {
        orders: orders.map((o) => ({
          ...o,
          currencyLabel: currencyLabel(ctx.organization.currency),
        })),
      };
    },
  },

  getOrderDetails: {
    permission: "orders.read",
    args: z.object({ orderId: z.string().min(1) }),
    async run(ctx, raw) {
      const { orderId } = raw as { orderId: string };
      const order = await prisma.order.findFirst({
        where: { id: orderId, organizationId: ctx.organizationId },
        include: {
          items: { select: { productNameSnapshot: true, quantity: true, unitPrice: true } },
          customer: { select: { id: true, displayName: true, assignedToUserId: true } },
        },
      });
      if (!order) return { found: false };
      if (!systemAiCustomerGuard(ctx.principal, order.customer.id)) {
        return { found: false, restricted: true };
      }
      if (
        ctx.principal.kind === "USER" &&
        ctx.principal.role === "SALES" &&
        order.createdByUserId !== ctx.principal.userId &&
        order.customer.assignedToUserId !== ctx.principal.userId
      ) {
        return { found: false, restricted: true };
      }
      return {
        found: true,
        reference: order.reference,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        amountPaid: order.amountPaid,
        items: order.items,
        currencyLabel: currencyLabel(ctx.organization.currency),
      };
    },
  },

  getDebtsOverview: {
    permission: "debts.read",
    args: z.object({}).default({}),
    async run(ctx) {
      const scope =
        ctx.principal.kind === "USER"
          ? orderScopeWhere(ctx.principal.role, ctx.principal.userId)
          : {};
      const o = await getDebtsOverview(ctx.organizationId, { scopeWhere: scope });
      return {
        totalOutstanding: o.totalOutstanding,
        overdueOutstanding: o.overdueOutstanding,
        notDueOutstanding: o.notDueOutstanding,
        debtorCount: o.debtorCount,
        orderCount: o.orderCount,
        currencyLabel: currencyLabel(ctx.organization.currency),
      };
    },
  },

  getBusinessDailySummary: {
    permission: "orders.read",
    args: z.object({}).default({}),
    async run(ctx) {
      const { gte, lt } = todayRange(ctx.organization.timezone);
      const [salesAgg, ordersToday, newCustomers] = await Promise.all([
        prisma.order.aggregate({
          where: {
            organizationId: ctx.organizationId,
            status: "DELIVERED",
            deliveredAt: { gte, lt },
          },
          _sum: { totalAmount: true },
        }),
        prisma.order.count({
          where: { organizationId: ctx.organizationId, createdAt: { gte, lt } },
        }),
        prisma.customer.count({
          where: { organizationId: ctx.organizationId, createdAt: { gte, lt } },
        }),
      ]);

      const canCash = principalCan(ctx.principal, "debts.read");
      const cash = canCash
        ? await getCashCollectedToday(
            ctx.organizationId,
            ctx.organization.timezone,
          )
        : null;

      return {
        salesToday: salesAgg._sum.totalAmount ?? 0,
        ordersToday,
        newCustomersToday: newCustomers,
        ...(cash ? { cashCollectedToday: cash.amount } : {}),
        currencyLabel: currencyLabel(ctx.organization.currency),
      };
    },
  },
};

export function isKnownTool(name: string): name is AiToolName {
  return name in CAPABILITIES;
}

/**
 * Point d'entrée unique. Refuse un tool inconnu, une permission manquante, des
 * args invalides — AVANT toute lecture. `organizationId` est ignoré s'il est
 * présent dans `args` (il vient du contexte).
 */
export async function runCapability(
  ctx: CapabilityContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CapabilityResult> {
  if (!isKnownTool(toolName)) {
    return { ok: false, code: "UNKNOWN_TOOL", message: `Outil inconnu : ${toolName}.` };
  }
  const cap = CAPABILITIES[toolName];

  if (!principalCan(ctx.principal, cap.permission)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `Permission « ${cap.permission} » requise pour ${toolName}.`,
    };
  }

  const { organizationId: _drop, ...safeArgs } = args;
  const parsed = cap.args.safeParse(safeArgs);
  if (!parsed.success) {
    return { ok: false, code: "BAD_ARGS", message: "Arguments invalides." };
  }

  try {
    const data = await cap.run(ctx, parsed.data);
    return { ok: true, data };
  } catch {
    return { ok: false, code: "ERROR", message: `Échec de l'outil ${toolName}.` };
  }
}
