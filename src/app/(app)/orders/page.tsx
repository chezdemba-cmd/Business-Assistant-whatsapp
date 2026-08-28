import Link from "next/link";
import type { OrderPaymentStatus, OrderSource, OrderStatus, Prisma } from "@prisma/client";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { orderScopeWhere, canSeeAllCrm } from "@/server/crm/scope";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
} from "@/server/orders/order-status";
import { PAYMENT_STATUS_LABEL, ORDER_SOURCE_LABEL } from "@/lib/labels";
import { formatAmount, formatDate } from "@/lib/format";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { Pager } from "@/components/Pager";
import { OrdersFilters } from "@/components/orders/OrdersFilters";

export const metadata = { title: "Commandes — Djeli" };

const KANBAN_COLUMNS: OrderStatus[] = [
  "NEW",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
];
const PER_PAGE = 25;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "orders.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="les commandes" />;
  }
  const orgId = ctx.organization.id;
  const currency = ctx.organization.currency;
  const scope = orderScopeWhere(ctx.role, ctx.user.id);

  const statusParam = ORDER_STATUSES.includes(sp.status as never)
    ? (sp.status as OrderStatus)
    : undefined;
  const paymentParam = sp.payment as OrderPaymentStatus | undefined;
  const sourceParam = sp.source as OrderSource | undefined;
  const q = (sp.q ?? "").trim();
  const listMode = Boolean(statusParam || paymentParam || sourceParam || q || sp.from);

  const canCreate = can(ctx.role, "orders.write");
  const header = (
    <PageHeader
      title="Commandes"
      subtitle={
        canSeeAllCrm(ctx.role)
          ? "Chaque changement de statut est historisé avec son auteur."
          : "Vos commandes et celles de vos clients assignés."
      }
      actions={
        canCreate ? (
          <Link className="dj-btn dj-btn--primary" href="/orders/new">
            Créer une commande
          </Link>
        ) : undefined
      }
    />
  );

  if (!listMode) {
    const orders = await prisma.order.findMany({
      where: { organizationId: orgId, ...scope, status: { in: KANBAN_COLUMNS } },
      include: { customer: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const byStatus = new Map<OrderStatus, typeof orders>();
    for (const s of KANBAN_COLUMNS) byStatus.set(s, []);
    for (const o of orders) byStatus.get(o.status)?.push(o);

    return (
      <>
        {header}
        <OrdersFilters />
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <Link href="/orders?status=DELIVERED" className="dj-badge" style={{ textDecoration: "none" }}>
            Livrées →
          </Link>
          <Link href="/orders?status=CANCELLED" className="dj-badge" style={{ textDecoration: "none" }}>
            Annulées →
          </Link>
        </div>
        {orders.length === 0 ? (
          <EmptyState
            title="Aucune commande ouverte"
            message="Créez une commande pour la voir apparaître ici."
            action={
              canCreate ? (
                <Link className="dj-btn dj-btn--primary" href="/orders/new">
                  Créer une commande
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(220px, 1fr))",
              gap: 14,
              alignItems: "start",
              overflowX: "auto",
              paddingBottom: 8,
            }}
          >
            {KANBAN_COLUMNS.map((status) => {
              const col = byStatus.get(status) ?? [];
              return (
                <div
                  key={status}
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 24,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      color: "var(--text-2)",
                      textTransform: "uppercase",
                      padding: "0 4px",
                    }}
                  >
                    {ORDER_STATUS_LABEL[status]}
                    <span style={{ marginLeft: "auto", color: "var(--text-3)" }}>
                      {col.length}
                    </span>
                  </div>
                  {col.map((o) => (
                    <Link
                      key={o.id}
                      href={`/orders/${o.id}`}
                      style={{
                        background: "#fff",
                        border: "1px solid var(--border-soft)",
                        borderRadius: 16,
                        padding: 12,
                        textDecoration: "none",
                        color: "inherit",
                        display: "block",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {o.reference}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {formatDate(o.createdAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {o.customer.displayName}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        <span
                          className="tnum"
                          style={{ fontFamily: "var(--font-display)", fontSize: 16 }}
                        >
                          {formatAmount(o.totalAmount, currency)}
                        </span>
                        <Badge variant={o.paymentStatus === "PAID" ? "ok" : "accent"}>
                          {PAYMENT_STATUS_LABEL[o.paymentStatus]}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  // ── Vue liste (filtres actifs) ──
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const where: Prisma.OrderWhereInput = {
    organizationId: orgId,
    ...scope,
    ...(statusParam ? { status: statusParam } : {}),
    ...(paymentParam ? { paymentStatus: paymentParam } : {}),
    ...(sourceParam ? { source: sourceParam } : {}),
    ...(sp.from ? { createdAt: { gte: new Date(sp.from) } } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { customer: { displayName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, displayName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  return (
    <>
      {header}
      <OrdersFilters />
      <Link
        href="/orders"
        style={{ fontSize: 13, color: "var(--accent-active)", display: "inline-block", marginBottom: 12 }}
      >
        ← Vue Kanban
      </Link>
      {total === 0 ? (
        <EmptyState title="Aucune commande" message="Aucune commande ne correspond à ces filtres." />
      ) : (
        <>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "var(--panel)" }}>
                    {["Réf.", "Client", "Articles", "Statut", "Paiement", "Source", "Total", "Date"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "14px 16px",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            color: "var(--text-2)",
                            textTransform: "uppercase",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                      <td style={{ padding: "13px 16px" }}>
                        <Link href={`/orders/${o.id}`} className="mono" style={{ fontWeight: 700 }}>
                          {o.reference}
                        </Link>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <Link href={`/customers/${o.customer.id}`}>{o.customer.displayName}</Link>
                      </td>
                      <td className="tnum" style={{ padding: "13px 16px" }}>{o._count.items}</td>
                      <td style={{ padding: "13px 16px" }}>
                        <Badge>{ORDER_STATUS_LABEL[o.status]}</Badge>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <Badge variant={o.paymentStatus === "PAID" ? "ok" : "accent"}>
                          {PAYMENT_STATUS_LABEL[o.paymentStatus]}
                        </Badge>
                      </td>
                      <td style={{ padding: "13px 16px", color: "var(--text-2)" }}>
                        {ORDER_SOURCE_LABEL[o.source]}
                      </td>
                      <td className="tnum" style={{ padding: "13px 16px", fontWeight: 700 }}>
                        {formatAmount(o.totalAmount, currency)}
                      </td>
                      <td style={{ padding: "13px 16px", color: "var(--text-3)", fontSize: 13 }}>
                        {formatDate(o.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager basePath="/orders" searchParams={sp} page={page} total={total} perPage={PER_PAGE} />
        </>
      )}
    </>
  );
}
