import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { canActOnOrder } from "@/server/crm/scope";
import { areItemsEditable } from "@/server/orders/order-status";
import { getStockSnapshots } from "@/server/stock/stock-service";
import { PageHeader } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { EditOrderLinesForm } from "@/components/orders/EditOrderLinesForm";
import type { OrderLine } from "@/components/orders/OrderLines";

export const metadata = { title: "Modifier la commande — Djeli" };

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "orders.write")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="la modification de commandes" />;
  }

  const order = await prisma.order.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: {
      items: true,
      customer: { select: { assignedToUserId: true } },
    },
  });
  if (!order) notFound();
  if (!canActOnOrder(ctx.role, ctx.user.id, order)) notFound();
  if (!areItemsEditable(order.status)) redirect(`/orders/${order.id}`);

  const products = await prisma.product.findMany({
    where: {
      id: { in: order.items.map((i) => i.productId) },
      organizationId: ctx.organization.id,
    },
    select: { id: true, name: true, sku: true, salePrice: true, alertThreshold: true, purchasePrice: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const snapshots = await getStockSnapshots(
    ctx.organization.id,
    products.map((p) => ({
      id: p.id,
      alertThreshold: p.alertThreshold,
      purchasePrice: p.purchasePrice,
    })),
  );

  const initialLines: OrderLine[] = order.items.map((it) => {
    const p = productMap.get(it.productId);
    const snap = snapshots.get(it.productId);
    // La réservation actuelle de CETTE commande est comprise dans "reserved" ;
    // on la rajoute pour obtenir le plafond réel disponible à l'édition.
    const available = (snap?.available ?? 0) + it.quantity;
    return {
      productId: it.productId,
      name: p?.name ?? it.productNameSnapshot,
      sku: p?.sku ?? it.skuSnapshot,
      unitPrice: p?.salePrice ?? it.unitPrice,
      quantity: it.quantity,
      available,
    };
  });

  return (
    <>
      <Link
        href={`/orders/${order.id}`}
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← {order.reference}
      </Link>
      <PageHeader
        title={`Modifier ${order.reference}`}
        subtitle="Modification possible uniquement en statut Nouvelle ou À confirmer."
      />
      <EditOrderLinesForm
        organizationId={ctx.organization.id}
        orderId={order.id}
        currency={order.currency}
        initialLines={initialLines}
        initialDiscount={order.discountAmount}
        initialDelivery={order.deliveryFee}
        initialNotes={order.notes ?? ""}
      />
    </>
  );
}
