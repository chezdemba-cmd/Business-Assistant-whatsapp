import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { canActOnOrder } from "@/server/crm/scope";
import {
  ORDER_STATUS_LABEL,
  areItemsEditable,
} from "@/server/orders/order-status";
import { PAYMENT_STATUS_LABEL, ORDER_SOURCE_LABEL } from "@/lib/labels";
import { formatAmount, formatDate, formatDateTime } from "@/lib/format";
import { getOrderPaymentSummary } from "@/server/finance/finance-service";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_PROVIDER_LABEL,
} from "@/server/finance/payment-rules";
import { Card, PageHeader, Badge } from "@/components/ui";
import { OrderStatusActions } from "@/components/orders/OrderStatusActions";
import { RecordPaymentForm } from "@/components/finance/RecordPaymentForm";
import { CancelPaymentButton } from "@/components/finance/CancelPaymentButton";
import { DueDateForm } from "@/components/finance/DueDateForm";
import { PrepareReminderButton } from "@/components/finance/PrepareReminderButton";

export const metadata = { title: "Commande — Djeli" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "orders.read")) notFound();

  const order = await prisma.order.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: {
      customer: {
        select: {
          id: true,
          displayName: true,
          phone: true,
          area: true,
          assignedToUserId: true,
        },
      },
      items: { orderBy: { productNameSnapshot: "asc" } },
      createdBy: { select: { firstName: true, lastName: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();
  if (!canActOnOrder(ctx.role, ctx.user.id, order)) notFound();

  const currency = order.currency;
  const canWrite = can(ctx.role, "orders.write");
  const canPay = can(ctx.role, "debts.write");
  const canSeeDebts = can(ctx.role, "debts.read");

  const [paySummary, payments] = await Promise.all([
    getOrderPaymentSummary(ctx.organization.id, order.id),
    canSeeDebts
      ? prisma.payment.findMany({
          where: { organizationId: ctx.organization.id, orderId: order.id },
          orderBy: { paidAt: "desc" },
          include: {
            recordedBy: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <Link
        href="/orders"
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← Commandes
      </Link>

      <PageHeader
        title={order.reference}
        subtitle={`Créée le ${formatDate(order.createdAt)}${
          order.createdBy
            ? ` par ${order.createdBy.firstName} ${order.createdBy.lastName}`
            : ""
        } · ${ORDER_SOURCE_LABEL[order.source]}`}
        actions={
          canWrite && areItemsEditable(order.status) ? (
            <Link className="dj-btn dj-btn--outline" href={`/orders/${order.id}/edit`}>
              Modifier les articles
            </Link>
          ) : undefined
        }
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <Badge variant="accent">{ORDER_STATUS_LABEL[order.status]}</Badge>
        <Badge variant={order.paymentStatus === "PAID" ? "ok" : "default"}>
          {PAYMENT_STATUS_LABEL[order.paymentStatus]}
        </Badge>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                background: "var(--card-alt)",
                borderRadius: 20,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {order.customer.displayName}
                </div>
                <div className="tnum" style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {order.customer.phone ?? "—"}
                  {order.customer.area ? ` · ${order.customer.area}` : ""}
                </div>
              </div>
              <Link
                href={`/customers/${order.customer.id}`}
                className="dj-btn dj-btn--outline"
                style={{ height: 34, fontSize: 12 }}
              >
                Voir la fiche
              </Link>
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 21, margin: "0 0 16px" }}>Articles</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {["Produit", "Qté", "P.U.", "Total"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 0 ? "left" : "right",
                        padding: "0 0 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color: "var(--text-2)",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "12px 0" }}>
                      <div style={{ fontWeight: 700 }}>{it.productNameSnapshot}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {it.skuSnapshot}
                      </div>
                    </td>
                    <td className="tnum" style={{ padding: "12px 0", textAlign: "right" }}>
                      {it.quantity}
                    </td>
                    <td className="tnum" style={{ padding: "12px 0", textAlign: "right" }}>
                      {formatAmount(it.unitPrice, currency)}
                    </td>
                    <td
                      className="tnum"
                      style={{ padding: "12px 0", textAlign: "right", fontWeight: 700 }}
                    >
                      {formatAmount(it.subtotal, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                fontSize: 14,
              }}
            >
              <TotalRow k="Sous-total" v={formatAmount(order.subtotal, currency)} />
              <TotalRow k="Remise" v={`- ${formatAmount(order.discountAmount, currency)}`} />
              <TotalRow k="Livraison" v={formatAmount(order.deliveryFee, currency)} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  paddingTop: 6,
                }}
              >
                <strong>Total</strong>
                <span
                  className="tnum"
                  style={{ fontFamily: "var(--font-display)", fontSize: 21 }}
                >
                  {formatAmount(order.totalAmount, currency)}
                </span>
              </div>
            </div>
          </Card>

          {order.notes || order.deliveryAddress ? (
            <Card>
              <h3 style={{ fontSize: 19, margin: "0 0 12px" }}>Livraison & notes</h3>
              {order.deliveryAddress ? (
                <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                  <strong>Adresse :</strong> {order.deliveryAddress}
                  {order.deliveryArea ? ` (${order.deliveryArea})` : ""}
                </p>
              ) : null}
              {order.requestedDeliveryAt ? (
                <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                  <strong>Date souhaitée :</strong> {formatDate(order.requestedDeliveryAt)}
                </p>
              ) : null}
              {order.notes ? (
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{order.notes}</p>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          {canWrite ? (
            <Card>
              <h3 style={{ fontSize: 19, margin: "0 0 14px" }}>Faire avancer</h3>
              <OrderStatusActions
                organizationId={ctx.organization.id}
                orderId={order.id}
                status={order.status}
              />
            </Card>
          ) : null}

          {canSeeDebts && paySummary ? (
            <Card>
              <h3 style={{ fontSize: 19, margin: "0 0 14px" }}>Paiement</h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 14,
                  marginBottom: 14,
                }}
              >
                <TotalRow k="Total" v={formatAmount(paySummary.totalAmount, currency)} />
                <TotalRow k="Payé" v={formatAmount(paySummary.amountPaid, currency)} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    paddingTop: 6,
                    borderTop: "1px solid var(--border-soft)",
                  }}
                >
                  <strong>Reste à payer</strong>
                  <span
                    className="tnum"
                    style={{ fontFamily: "var(--font-display)", fontSize: 19 }}
                  >
                    {formatAmount(paySummary.balanceDue, currency)}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <Badge variant={paySummary.paymentStatus === "PAID" ? "ok" : "default"}>
                  {PAYMENT_STATUS_LABEL[paySummary.paymentStatus]}
                </Badge>
                {paySummary.isOverdue ? (
                  <Badge variant="accent">
                    En retard · {paySummary.daysOverdue} j
                  </Badge>
                ) : null}
                {paySummary.dueDate && !paySummary.isOverdue ? (
                  <Badge>Échéance {formatDate(paySummary.dueDate)}</Badge>
                ) : null}
              </div>

              {canPay ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {paySummary.balanceDue > 0 ? (
                    <RecordPaymentForm
                      organizationId={ctx.organization.id}
                      customerId={order.customer.id}
                      currency={currency}
                      orderId={order.id}
                      balanceDue={paySummary.balanceDue}
                    />
                  ) : null}
                  <DueDateForm
                    organizationId={ctx.organization.id}
                    orderId={order.id}
                    dueDate={paySummary.dueDate}
                  />
                  {paySummary.isOverdue ? (
                    <PrepareReminderButton
                      organizationId={ctx.organization.id}
                      orderId={order.id}
                      compact
                    />
                  ) : null}
                </div>
              ) : null}

              {payments.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      color: "var(--text-3)",
                      textTransform: "uppercase",
                      marginBottom: 10,
                    }}
                  >
                    Historique des paiements
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          padding: "10px 12px",
                          border: "1px solid var(--border-soft)",
                          borderRadius: 14,
                          opacity: p.status === "CANCELLED" ? 0.55 : 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            alignItems: "baseline",
                          }}
                        >
                          <span
                            className="tnum"
                            style={{ fontWeight: 700 }}
                          >
                            {formatAmount(p.amount, p.currency)}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                            {formatDateTime(p.paidAt)}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                          {PAYMENT_METHOD_LABEL[p.method]}
                          {p.provider ? ` · ${PAYMENT_PROVIDER_LABEL[p.provider]}` : ""}
                          {p.recordedBy
                            ? ` · ${p.recordedBy.firstName} ${p.recordedBy.lastName}`
                            : ""}
                          {p.status === "CANCELLED" ? " · annulé" : ""}
                        </div>
                        {canPay && p.status !== "CANCELLED" ? (
                          <div style={{ marginTop: 8 }}>
                            <CancelPaymentButton
                              organizationId={ctx.organization.id}
                              paymentId={p.id}
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <h3 style={{ fontSize: 19, margin: "0 0 16px" }}>Historique des statuts</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {order.statusHistory.map((h, idx) => (
                <div key={h.id} style={{ display: "flex", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                    <div
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 999,
                        background: idx === order.statusHistory.length - 1 ? "var(--accent)" : "var(--border)",
                        marginTop: 4,
                      }}
                    />
                    {idx < order.statusHistory.length - 1 ? (
                      <div style={{ width: 2, flex: 1, background: "var(--border)", minHeight: 20 }} />
                    ) : null}
                  </div>
                  <div style={{ paddingBottom: 16, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.03em" }}>
                      {h.fromStatus ? `${ORDER_STATUS_LABEL[h.fromStatus]} → ` : ""}
                      {ORDER_STATUS_LABEL[h.toStatus]}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {formatDateTime(h.createdAt)} · {h.source}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p
              style={{
                marginTop: 4,
                paddingTop: 12,
                borderTop: "1px solid var(--border-soft)",
                fontSize: 12,
                color: "var(--text-3)",
                lineHeight: 1.5,
              }}
            >
              Après livraison, les lignes et l&apos;historique sont immuables.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function TotalRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--text-2)" }}>{k}</span>
      <span className="tnum">{v}</span>
    </div>
  );
}
