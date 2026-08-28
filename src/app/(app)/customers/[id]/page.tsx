import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { canAccessCustomer } from "@/server/crm/scope";
import { getCustomerStats } from "@/server/crm/customer-service";
import { getCustomerFinancialSummary } from "@/server/finance/finance-service";
import { balanceDue as calcBalanceDue } from "@/server/finance/payment-rules";
import { ORDER_STATUS_LABEL } from "@/server/orders/order-status";
import { CUSTOMER_TYPE_LABEL } from "@/lib/labels";
import { formatAmount, formatDate, formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";
import { CustomerArchiveToggle } from "@/components/customers/CustomerArchiveToggle";
import { RecordPaymentForm } from "@/components/finance/RecordPaymentForm";
import { PrepareReminderButton } from "@/components/finance/PrepareReminderButton";
import { MarketingConsentToggle } from "@/components/marketing/MarketingConsentToggle";

export const metadata = { title: "Fiche client — Djeli" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "customers.read")) notFound();

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { assignedTo: { select: { firstName: true, lastName: true } } },
  });
  if (!customer) notFound();
  if (!canAccessCustomer(ctx.role, ctx.user.id, customer)) notFound();

  const canSeeDebts = can(ctx.role, "debts.read");
  const canPay = can(ctx.role, "debts.write");

  const [stats, orders, activities, finance, openOrders, recentPayments] =
    await Promise.all([
      getCustomerStats(ctx.organization.id, customer.id),
      prisma.order.findMany({
        where: { organizationId: ctx.organization.id, customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { _count: { select: { items: true } } },
      }),
      prisma.customerActivity.findMany({
        where: { organizationId: ctx.organization.id, customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      canSeeDebts
        ? getCustomerFinancialSummary(ctx.organization.id, customer.id)
        : Promise.resolve(null),
      canSeeDebts
        ? prisma.order.findMany({
            where: {
              organizationId: ctx.organization.id,
              customerId: customer.id,
              status: "DELIVERED",
              paymentStatus: { not: "PAID" },
            },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              reference: true,
              totalAmount: true,
              amountPaid: true,
            },
          })
        : Promise.resolve([]),
      canSeeDebts
        ? prisma.payment.findMany({
            where: {
              organizationId: ctx.organization.id,
              customerId: customer.id,
            },
            orderBy: { paidAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

  const currency = ctx.organization.currency;
  const canWrite = can(ctx.role, "customers.write");
  const orderOptions = openOrders.map((o) => ({
    id: o.id,
    reference: o.reference,
    balanceDue: calcBalanceDue(o.totalAmount, o.amountPaid),
  }));

  return (
    <>
      <Link
        href="/customers"
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← Clients
      </Link>

      <PageHeader
        title={customer.displayName}
        subtitle={`${customer.phone ?? "sans téléphone"}${
          customer.area ? ` · ${customer.area}` : ""
        }${customer.status === "ARCHIVED" ? " · archivé" : ""}`}
        actions={
          <>
            {can(ctx.role, "orders.write") ? (
              <Link className="dj-btn dj-btn--primary" href={`/orders/new?customer=${customer.id}`}>
                Nouvelle commande
              </Link>
            ) : null}
            {canWrite ? (
              <Link className="dj-btn dj-btn--outline" href={`/customers/${customer.id}/edit`}>
                Modifier
              </Link>
            ) : null}
            {canWrite ? (
              <CustomerArchiveToggle
                organizationId={ctx.organization.id}
                customerId={customer.id}
                archived={customer.status === "ARCHIVED"}
              />
            ) : null}
          </>
        }
      />

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
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
                gap: 14,
              }}
            >
              <Metric label="Commandes" value={String(stats.orderCount)} />
              <Metric
                label="Total achats"
                value={formatAmount(stats.totalSpent, currency)}
                hint="commandes livrées"
              />
              <Metric
                label="Dernière"
                value={stats.lastOrderAt ? formatDate(stats.lastOrderAt) : "—"}
              />
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 21, margin: "0 0 16px" }}>Commandes récentes</h3>
            {orders.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
                Aucune commande.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {orders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/orders/${o.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 0",
                      borderBottom: "1px solid var(--border-soft)",
                      color: "inherit",
                      textDecoration: "none",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
                      {o.reference}
                    </span>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {o._count.items} article{o._count.items > 1 ? "s" : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {formatDate(o.createdAt)}
                      </div>
                    </div>
                    <Badge>{ORDER_STATUS_LABEL[o.status]}</Badge>
                    <span
                      className="tnum"
                      style={{ fontFamily: "var(--font-display)", fontSize: 16 }}
                    >
                      {formatAmount(o.totalAmount, currency)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <Card>
            <h3 style={{ fontSize: 19, margin: "0 0 16px" }}>Fiche</h3>
            <dl style={{ display: "flex", flexDirection: "column", gap: 14, margin: 0, fontSize: 13 }}>
              <Row k="Type" v={customer.customerType ? CUSTOMER_TYPE_LABEL[customer.customerType] : "—"} />
              <Row k="Boutique" v={customer.businessName ?? "—"} />
              <Row
                k="Localisation"
                v={[customer.area, customer.city].filter(Boolean).join(", ") || "—"}
              />
              <Row k="Adresse" v={customer.address ?? "—"} />
              <Row
                k="Commercial assigné"
                v={
                  customer.assignedTo
                    ? `${customer.assignedTo.firstName} ${customer.assignedTo.lastName}`
                    : "—"
                }
              />
              <Row k="Source" v={customer.source} />
              <MarketingConsentToggle
                customerId={customer.id}
                optedIn={customer.marketingOptIn && !customer.marketingOptOutAt}
                canEdit={can(ctx.role, "customers.write")}
              />
              {customer.notes ? (
                <div>
                  <dt style={{ color: "var(--text-3)", fontWeight: 600, marginBottom: 2 }}>
                    Notes
                  </dt>
                  <dd style={{ margin: 0, lineHeight: 1.5 }}>{customer.notes}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {canSeeDebts && finance ? (
            <Card>
              <h3 style={{ fontSize: 19, margin: "0 0 16px" }}>Créances</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                <Metric
                  label="Total acheté"
                  value={formatAmount(finance.totalPurchased, currency)}
                  hint="commandes livrées"
                />
                <Metric
                  label="Total payé"
                  value={formatAmount(finance.totalPaid, currency)}
                />
                <Metric
                  label="Solde dû"
                  value={formatAmount(finance.totalOutstanding, currency)}
                />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {finance.overdueOutstanding > 0 ? (
                  <Badge variant="accent">
                    En retard : {formatAmount(finance.overdueOutstanding, currency)}
                  </Badge>
                ) : null}
                <Badge>
                  {finance.unpaidOrdersCount} commande
                  {finance.unpaidOrdersCount > 1 ? "s" : ""} impayée
                  {finance.unpaidOrdersCount > 1 ? "s" : ""}
                </Badge>
                {finance.oldestDueDate ? (
                  <Badge>
                    Plus ancienne échéance : {formatDate(finance.oldestDueDate)}
                  </Badge>
                ) : null}
              </div>

              {recentPayments.length > 0 ? (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      color: "var(--text-3)",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Paiements récents
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {recentPayments.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          color: p.status === "CANCELLED" ? "var(--text-3)" : "inherit",
                        }}
                      >
                        <span className="tnum" style={{ fontWeight: 700 }}>
                          {formatAmount(p.amount, p.currency)}
                          {p.status === "CANCELLED" ? " (annulé)" : ""}
                        </span>
                        <span style={{ color: "var(--text-3)" }}>
                          {formatDate(p.paidAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {canPay ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <RecordPaymentForm
                    organizationId={ctx.organization.id}
                    customerId={customer.id}
                    currency={currency}
                    orderOptions={orderOptions}
                  />
                  {finance.totalOutstanding > 0 ? (
                    <PrepareReminderButton
                      organizationId={ctx.organization.id}
                      customerId={customer.id}
                      compact
                    />
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <h3 style={{ fontSize: 19, margin: "0 0 16px" }}>Activité</h3>
            {activities.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
                Aucune activité.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {activities.map((a) => (
                  <div key={a.id} style={{ display: "flex", gap: 12 }}>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: "var(--accent)",
                        marginTop: 7,
                        flex: "none",
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {formatDateTime(a.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "var(--text-3)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 21 }}>
        {value}
      </div>
      {hint ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</div> : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt style={{ color: "var(--text-3)", fontWeight: 600, marginBottom: 2 }}>{k}</dt>
      <dd style={{ margin: 0, fontWeight: 700 }}>{v}</dd>
    </div>
  );
}
