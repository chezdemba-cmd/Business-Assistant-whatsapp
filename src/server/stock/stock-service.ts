import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logError } from "@/server/errors";
import {
  availableStock,
  movementPhysicalDelta,
  stockState,
  stockValueAtPurchasePrice,
  STOCK_STATE_LABEL,
  type StockState,
} from "./movement-rules";

type Db = PrismaClient | Prisma.TransactionClient;

export type StockSnapshot = {
  physical: number;
  reserved: number;
  available: number;
  state: StockState;
  stateLabel: string;
  /** Valeur estimée au prix d'achat courant (pas de FIFO/CUMP). */
  value: number;
  /** Anomalie : disponible < 0 (historique incohérent). */
  incoherent: boolean;
};

type ProductStockInput = {
  id: string;
  alertThreshold: number;
  purchasePrice: number | null;
};

function buildSnapshot(
  product: ProductStockInput,
  physical: number,
  reserved: number,
): StockSnapshot {
  const available = availableStock(physical, reserved);
  const incoherent = available < 0;
  if (incoherent) {
    logError("stock-incoherent", {
      productId: product.id,
      physical,
      reserved,
      available,
    });
  }
  const state = stockState(available, product.alertThreshold);
  return {
    physical,
    reserved,
    available,
    state,
    stateLabel: STOCK_STATE_LABEL[state],
    value: stockValueAtPurchasePrice(physical, product.purchasePrice),
    incoherent,
  };
}

/**
 * Snapshots de stock pour un lot de produits — une seule requête d'agrégat
 * par dimension (mouvements, réservations). Pas de N+1, pas de cache.
 */
export async function getStockSnapshots(
  organizationId: string,
  products: ProductStockInput[],
  db: Db = prisma,
): Promise<Map<string, StockSnapshot>> {
  const result = new Map<string, StockSnapshot>();
  if (products.length === 0) return result;

  const ids = products.map((p) => p.id);

  const [movementGroups, reservationGroups] = await Promise.all([
    db.stockMovement.groupBy({
      by: ["productId", "type"],
      where: { organizationId, productId: { in: ids } },
      _sum: { quantity: true },
    }),
    db.stockReservation.groupBy({
      by: ["productId"],
      where: { organizationId, productId: { in: ids }, status: "ACTIVE" },
      _sum: { quantity: true },
    }),
  ]);

  const physicalById = new Map<string, number>();
  for (const g of movementGroups) {
    const qty = g._sum.quantity ?? 0;
    physicalById.set(
      g.productId,
      (physicalById.get(g.productId) ?? 0) + movementPhysicalDelta(g.type, qty),
    );
  }

  const reservedById = new Map<string, number>();
  for (const g of reservationGroups) {
    reservedById.set(g.productId, g._sum.quantity ?? 0);
  }

  for (const product of products) {
    result.set(
      product.id,
      buildSnapshot(
        product,
        physicalById.get(product.id) ?? 0,
        reservedById.get(product.id) ?? 0,
      ),
    );
  }
  return result;
}

export async function getStockSnapshot(
  organizationId: string,
  product: ProductStockInput,
  db: Db = prisma,
): Promise<StockSnapshot> {
  const map = await getStockSnapshots(organizationId, [product], db);
  return (
    map.get(product.id) ?? buildSnapshot(product, 0, 0)
  );
}

/** Stock physique seul (utile dans les transactions : création produit, ajustement). */
export async function getPhysicalStock(
  organizationId: string,
  productId: string,
  db: Db = prisma,
): Promise<number> {
  const groups = await db.stockMovement.groupBy({
    by: ["type"],
    where: { organizationId, productId },
    _sum: { quantity: true },
  });
  return groups.reduce(
    (sum, g) => sum + movementPhysicalDelta(g.type, g._sum.quantity ?? 0),
    0,
  );
}

/** Stock réservé seul (réservations ACTIVE). */
export async function getReservedStock(
  organizationId: string,
  productId: string,
  db: Db = prisma,
): Promise<number> {
  const agg = await db.stockReservation.aggregate({
    where: { organizationId, productId, status: "ACTIVE" },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

export type StockSummary = {
  productCount: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  incoherent: number;
  /** Somme des valeurs estimées au prix d'achat (produits sans prix d'achat = 0). */
  stockValue: number;
};

/** Résumé stock d'une organisation (produits non archivés). */
export async function getStockSummary(
  organizationId: string,
  db: Db = prisma,
): Promise<StockSummary> {
  const products = await db.product.findMany({
    where: { organizationId, status: { not: "ARCHIVED" } },
    select: { id: true, alertThreshold: true, purchasePrice: true },
  });
  const snapshots = await getStockSnapshots(organizationId, products, db);

  const summary: StockSummary = {
    productCount: products.length,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    incoherent: 0,
    stockValue: 0,
  };
  for (const snap of snapshots.values()) {
    if (snap.state === "IN_STOCK") summary.inStock += 1;
    else if (snap.state === "LOW_STOCK") summary.lowStock += 1;
    else summary.outOfStock += 1;
    if (snap.incoherent) summary.incoherent += 1;
    summary.stockValue += snap.value;
  }
  return summary;
}

/** Nombre de produits sous le seuil (LOW ou RUPTURE) — pour le dashboard. */
export async function countProductsBelowThreshold(
  organizationId: string,
  db: Db = prisma,
): Promise<number> {
  const summary = await getStockSummary(organizationId, db);
  return summary.lowStock + summary.outOfStock;
}
