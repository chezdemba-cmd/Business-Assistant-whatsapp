import "server-only";
import {
  Prisma,
  type OrderEventSource,
  type OrderSource,
  type OrderStatus,
  type Product,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { Conflict, NotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import {
  getPhysicalStock,
  getReservedStock,
} from "@/server/stock/stock-service";
import { availableStock } from "@/server/stock/movement-rules";
import { computeOrderTotals, OrderPricingError } from "./pricing";
import { formatOrderReference } from "./reference";
import {
  ORDER_STATUS_LABEL,
  areItemsEditable,
  canTransitionOrderStatus,
  fulfillsReservations,
  releasesReservations,
} from "./order-status";

type Tx = Prisma.TransactionClient;

const TX_OPTS = { timeout: 20_000 } as const;

/** Verrou déterministe (ordre trié) des lignes produit → sérialise les
 *  réservations concurrentes pour un même produit, quel que soit le niveau
 *  d'isolation. */
async function lockProductRows(tx: Tx, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const sorted = [...new Set(productIds)].sort();
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "products" WHERE id IN (${Prisma.join(
      sorted,
    )}) ORDER BY id FOR UPDATE`,
  );
}

async function lockOrderRow(tx: Tx, orderId: string): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`,
  );
}

function sourceToEvent(source: OrderSource): OrderEventSource {
  switch (source) {
    case "WHATSAPP":
      return "WHATSAPP";
    case "AI":
      return "AI";
    case "IMPORT":
      return "SYSTEM";
    default:
      return "MANUAL";
  }
}

function dedupeLines(lines: CreateOrderLine[]): Map<string, number> {
  const byProduct = new Map<string, number>();
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
      throw Conflict("Quantité de ligne invalide.");
    }
    byProduct.set(l.productId, (byProduct.get(l.productId) ?? 0) + l.quantity);
  }
  if (byProduct.size === 0) throw Conflict("Ajoutez au moins un article.");
  return byProduct;
}

async function loadProducts(
  tx: Tx,
  organizationId: string,
  productIds: string[],
): Promise<Map<string, Product>> {
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, organizationId },
  });
  const map = new Map(products.map((p) => [p.id, p]));
  for (const id of productIds) {
    const p = map.get(id);
    if (!p) throw NotFound("Produit introuvable dans cette entreprise.");
    if (p.status === "ARCHIVED") {
      throw Conflict(`Le produit « ${p.name} » est archivé.`);
    }
  }
  return map;
}

// ── Création ─────────────────────────────────────────────────────────

export type CreateOrderLine = { productId: string; quantity: number };

export type CreateOrderInput = {
  organizationId: string;
  actorUserId: string;
  customerId: string;
  lines: CreateOrderLine[];
  discountAmount?: number;
  deliveryFee?: number;
  notes?: string | null;
  deliveryAddress?: string | null;
  deliveryArea?: string | null;
  requestedDeliveryAt?: Date | null;
  source?: OrderSource;
};

export async function createOrder(
  input: CreateOrderInput,
): Promise<{ orderId: string; reference: string }> {
  const byProduct = dedupeLines(input.lines);
  const productIds = [...byProduct.keys()].sort();

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { currency: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, organizationId: input.organizationId },
      select: { id: true, status: true },
    });
    if (!customer) throw NotFound("Client introuvable dans cette entreprise.");
    if (customer.status === "ARCHIVED") throw Conflict("Ce client est archivé.");

    const productMap = await loadProducts(tx, input.organizationId, productIds);
    await lockProductRows(tx, productIds);

    const lines: Array<{
      productId: string;
      product: Product;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }> = [];

    for (const pid of productIds) {
      const product = productMap.get(pid)!;
      const quantity = byProduct.get(pid)!;
      const [physical, reserved] = await Promise.all([
        getPhysicalStock(input.organizationId, pid, tx),
        getReservedStock(input.organizationId, pid, tx),
      ]);
      const available = availableStock(physical, reserved);
      if (quantity > available) {
        throw Conflict(
          `Stock insuffisant pour ${product.name}.\nDisponible : ${available}\nDemandé : ${quantity}`,
        );
      }
      // PRIX SERVEUR — jamais celui envoyé par le client.
      const unitPrice = product.salePrice;
      lines.push({
        productId: pid,
        product,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
      });
    }

    let totals;
    try {
      totals = computeOrderTotals({
        lines: lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
        discountAmount: input.discountAmount,
        deliveryFee: input.deliveryFee,
      });
    } catch (e) {
      if (e instanceof OrderPricingError) throw Conflict(e.message);
      throw e;
    }

    const counter = await tx.orderCounter.upsert({
      where: { organizationId: input.organizationId },
      create: { organizationId: input.organizationId, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const orderNumber = counter.lastNumber;
    const reference = formatOrderReference(orderNumber);
    const source = input.source ?? "MANUAL";

    const order = await tx.order.create({
      data: {
        organizationId: input.organizationId,
        customerId: customer.id,
        orderNumber,
        reference,
        status: "NEW",
        paymentStatus: "UNPAID",
        source,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        deliveryFee: totals.deliveryFee,
        totalAmount: totals.totalAmount,
        currency: org.currency,
        notes: input.notes ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
        deliveryArea: input.deliveryArea ?? null,
        requestedDeliveryAt: input.requestedDeliveryAt ?? null,
        createdByUserId: input.actorUserId,
      },
    });

    await tx.orderItem.createMany({
      data: lines.map((l) => ({
        organizationId: input.organizationId,
        orderId: order.id,
        productId: l.productId,
        productNameSnapshot: l.product.name,
        skuSnapshot: l.product.sku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        subtotal: l.subtotal,
      })),
    });

    for (const l of lines) {
      await tx.stockReservation.create({
        data: {
          organizationId: input.organizationId,
          productId: l.productId,
          quantity: l.quantity,
          status: "ACTIVE",
          sourceType: "ORDER",
          sourceId: order.id,
        },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        organizationId: input.organizationId,
        orderId: order.id,
        fromStatus: null,
        toStatus: "NEW",
        actorUserId: input.actorUserId,
        source: sourceToEvent(source),
      },
    });

    await tx.customerActivity.create({
      data: {
        organizationId: input.organizationId,
        customerId: customer.id,
        type: "ORDER_CREATED",
        title: `Commande ${reference} créée`,
        actorUserId: input.actorUserId,
        metadata: { orderId: order.id, total: totals.totalAmount },
      },
    });

    return { order, lineCount: lines.length };
  }, TX_OPTS);

  await writeAuditLog({
    action: "ORDER_CREATED",
    entityType: "order",
    entityId: result.order.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: {
      reference: result.order.reference,
      total: result.order.totalAmount,
      lineCount: result.lineCount,
    },
  });
  await writeAuditLog({
    action: "STOCK_RESERVED",
    entityType: "order",
    entityId: result.order.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { reference: result.order.reference, lines: result.lineCount },
  });

  return { orderId: result.order.id, reference: result.order.reference };
}

// ── Modification des lignes (NEW / PENDING uniquement) ────────────────

export type UpdateOrderItemsInput = {
  organizationId: string;
  actorUserId: string;
  orderId: string;
  lines: CreateOrderLine[];
  discountAmount?: number;
  deliveryFee?: number;
  notes?: string | null;
};

export async function updateOrderItems(
  input: UpdateOrderItemsInput,
): Promise<{ orderId: string }> {
  const byProduct = dedupeLines(input.lines);

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, organizationId: input.organizationId },
      include: { items: { select: { productId: true } } },
    });
    if (!order) throw NotFound("Commande introuvable dans cette entreprise.");
    if (!areItemsEditable(order.status)) {
      throw Conflict("Cette commande n'est plus modifiable à ce stade.");
    }

    await lockOrderRow(tx, order.id);
    const productIds = [
      ...new Set([...byProduct.keys(), ...order.items.map((i) => i.productId)]),
    ].sort();
    const productMap = await loadProducts(tx, input.organizationId, [
      ...byProduct.keys(),
    ]);
    await lockProductRows(tx, productIds);

    // Libère d'abord toutes les réservations ACTIVE de cette commande.
    const active = await tx.stockReservation.findMany({
      where: {
        organizationId: input.organizationId,
        sourceType: "ORDER",
        sourceId: order.id,
        status: "ACTIVE",
      },
    });
    for (const r of active) {
      await tx.stockReservation.update({
        where: { id: r.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
    }

    const lines: Array<{
      productId: string;
      product: Product;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }> = [];
    for (const pid of [...byProduct.keys()].sort()) {
      const product = productMap.get(pid)!;
      const quantity = byProduct.get(pid)!;
      const [physical, reserved] = await Promise.all([
        getPhysicalStock(input.organizationId, pid, tx),
        getReservedStock(input.organizationId, pid, tx),
      ]);
      const available = availableStock(physical, reserved);
      if (quantity > available) {
        throw Conflict(
          `Stock insuffisant pour ${product.name}.\nDisponible : ${available}\nDemandé : ${quantity}`,
        );
      }
      const unitPrice = product.salePrice;
      lines.push({
        productId: pid,
        product,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
      });
    }

    let totals;
    try {
      totals = computeOrderTotals({
        lines: lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
        discountAmount: input.discountAmount,
        deliveryFee: input.deliveryFee,
      });
    } catch (e) {
      if (e instanceof OrderPricingError) throw Conflict(e.message);
      throw e;
    }

    for (const l of lines) {
      await tx.stockReservation.create({
        data: {
          organizationId: input.organizationId,
          productId: l.productId,
          quantity: l.quantity,
          status: "ACTIVE",
          sourceType: "ORDER",
          sourceId: order.id,
        },
      });
    }

    await tx.orderItem.deleteMany({ where: { orderId: order.id } });
    await tx.orderItem.createMany({
      data: lines.map((l) => ({
        organizationId: input.organizationId,
        orderId: order.id,
        productId: l.productId,
        productNameSnapshot: l.product.name,
        skuSnapshot: l.product.sku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        subtotal: l.subtotal,
      })),
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        deliveryFee: totals.deliveryFee,
        totalAmount: totals.totalAmount,
        notes: input.notes ?? order.notes,
      },
    });
  }, TX_OPTS);

  await writeAuditLog({
    action: "ORDER_UPDATED",
    entityType: "order",
    entityId: input.orderId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { lineCount: byProduct.size },
  });
  return { orderId: input.orderId };
}

// ── Transition de statut ─────────────────────────────────────────────

export type TransitionOrderInput = {
  organizationId: string;
  actorUserId: string;
  orderId: string;
  to: OrderStatus;
  reason?: string | null;
  source?: OrderEventSource;
};

export async function transitionOrder(
  input: TransitionOrderInput,
): Promise<{ status: OrderStatus }> {
  const source = input.source ?? "MANUAL";

  const applied = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, organizationId: input.organizationId },
      select: {
        id: true,
        status: true,
        reference: true,
        customerId: true,
        totalAmount: true,
        amountPaid: true,
        dueDate: true,
      },
    });
    if (!order) throw NotFound("Commande introuvable dans cette entreprise.");
    await lockOrderRow(tx, order.id);

    // Relit après verrou (garde contre double transition concurrente).
    const fresh = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    const from = fresh.status;
    if (!canTransitionOrderStatus(from, input.to)) {
      throw Conflict(
        `Transition impossible : ${ORDER_STATUS_LABEL[from]} → ${ORDER_STATUS_LABEL[input.to]}.`,
      );
    }

    if (releasesReservations(input.to)) {
      const active = await tx.stockReservation.findMany({
        where: {
          organizationId: input.organizationId,
          sourceType: "ORDER",
          sourceId: order.id,
          status: "ACTIVE",
        },
      });
      for (const r of active) {
        await tx.stockReservation.update({
          where: { id: r.id },
          data: { status: "RELEASED", releasedAt: new Date() },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: input.to,
          cancelledAt: new Date(),
          cancellationReason: input.reason ?? null,
        },
      });
    } else if (fulfillsReservations(input.to)) {
      const active = await tx.stockReservation.findMany({
        where: {
          organizationId: input.organizationId,
          sourceType: "ORDER",
          sourceId: order.id,
          status: "ACTIVE",
        },
      });
      for (const r of active) {
        await tx.stockMovement.create({
          data: {
            organizationId: input.organizationId,
            productId: r.productId,
            type: "SALE",
            quantity: r.quantity,
            reference: order.reference,
            actorUserId: input.actorUserId,
            metadata: { reservationId: r.id, orderId: order.id },
          },
        });
        await tx.stockReservation.update({
          where: { id: r.id },
          data: { status: "FULFILLED", fulfilledAt: new Date() },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: { status: input.to, deliveredAt: new Date() },
      });
    } else if (input.to === "CONFIRMED") {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: input.to,
          confirmedByUserId: input.actorUserId,
          confirmedAt: new Date(),
        },
      });
    } else {
      await tx.order.update({
        where: { id: order.id },
        data: { status: input.to },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        organizationId: input.organizationId,
        orderId: order.id,
        fromStatus: from,
        toStatus: input.to,
        actorUserId: input.actorUserId,
        source,
        metadata: input.reason ? { reason: input.reason } : Prisma.JsonNull,
      },
    });

    const activityType =
      input.to === "CONFIRMED"
        ? "ORDER_CONFIRMED"
        : input.to === "DELIVERED"
          ? "ORDER_DELIVERED"
          : releasesReservations(input.to)
            ? "ORDER_CANCELLED"
            : null;
    if (activityType) {
      await tx.customerActivity.create({
        data: {
          organizationId: input.organizationId,
          customerId: order.customerId,
          type: activityType,
          title: `Commande ${order.reference} — ${ORDER_STATUS_LABEL[
            input.to
          ].toLowerCase()}`,
          actorUserId: input.actorUserId,
          metadata: { orderId: order.id },
        },
      });
    }

    // Livraison avec solde restant → naissance officielle d'une créance (§36).
    if (input.to === "DELIVERED" && order.totalAmount - order.amountPaid > 0) {
      await tx.customerActivity.create({
        data: {
          organizationId: input.organizationId,
          customerId: order.customerId,
          type: "DEBT_CREATED",
          title: `Créance ouverte sur ${order.reference}`,
          actorUserId: input.actorUserId,
          metadata: {
            orderId: order.id,
            balanceDue: order.totalAmount - order.amountPaid,
            dueDate: order.dueDate?.toISOString() ?? null,
          },
        },
      });
    }

    return { from, reference: order.reference };
  }, TX_OPTS);

  await writeAuditLog({
    action: "ORDER_STATUS_CHANGED",
    entityType: "order",
    entityId: input.orderId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { from: applied.from, to: input.to, reason: input.reason ?? undefined },
  });
  if (releasesReservations(input.to)) {
    await writeAuditLog({
      action: "ORDER_CANCELLED",
      entityType: "order",
      entityId: input.orderId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      metadata: { reason: input.reason ?? undefined },
    });
    await writeAuditLog({
      action: "STOCK_RESERVATION_RELEASED",
      entityType: "order",
      entityId: input.orderId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
    });
  }
  if (fulfillsReservations(input.to)) {
    await writeAuditLog({
      action: "ORDER_DELIVERED",
      entityType: "order",
      entityId: input.orderId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
    });
    await writeAuditLog({
      action: "STOCK_RESERVATION_FULFILLED",
      entityType: "order",
      entityId: input.orderId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
    });
  }

  return { status: input.to };
}
