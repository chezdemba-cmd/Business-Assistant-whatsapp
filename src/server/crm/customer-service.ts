import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type CustomerStats = {
  /** Commandes hors annulées / refusées. */
  orderCount: number;
  /** Somme `totalAmount` des commandes DELIVERED uniquement (§45). */
  totalSpent: number;
  lastOrderAt: Date | null;
};

const EMPTY: CustomerStats = { orderCount: 0, totalSpent: 0, lastOrderAt: null };

export async function getCustomerStatsMany(
  organizationId: string,
  customerIds: string[],
  db: Db = prisma,
): Promise<Map<string, CustomerStats>> {
  const map = new Map<string, CustomerStats>();
  if (customerIds.length === 0) return map;
  for (const id of customerIds) map.set(id, { ...EMPTY });

  const [counts, delivered, last] = await Promise.all([
    db.order.groupBy({
      by: ["customerId"],
      where: {
        organizationId,
        customerId: { in: customerIds },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      _count: { _all: true },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: {
        organizationId,
        customerId: { in: customerIds },
        status: "DELIVERED",
      },
      _sum: { totalAmount: true },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: { organizationId, customerId: { in: customerIds } },
      _max: { createdAt: true },
    }),
  ]);

  for (const row of counts) {
    const s = map.get(row.customerId);
    if (s) s.orderCount = row._count._all;
  }
  for (const row of delivered) {
    const s = map.get(row.customerId);
    if (s) s.totalSpent = row._sum.totalAmount ?? 0;
  }
  for (const row of last) {
    const s = map.get(row.customerId);
    if (s) s.lastOrderAt = row._max.createdAt ?? null;
  }
  return map;
}

export async function getCustomerStats(
  organizationId: string,
  customerId: string,
  db: Db = prisma,
): Promise<CustomerStats> {
  const map = await getCustomerStatsMany(organizationId, [customerId], db);
  return map.get(customerId) ?? { ...EMPTY };
}

/** Nom affiché : prénom + nom, sinon boutique, sinon fallback. */
export function deriveDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
}): string {
  const person = [input.firstName, input.lastName]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  return person || input.businessName?.trim() || "Client sans nom";
}
