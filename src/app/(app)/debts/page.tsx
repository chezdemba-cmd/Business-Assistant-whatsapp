import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { orderScopeWhere, canSeeAllCrm } from "@/server/crm/scope";
import {
  getDebtsOverview,
  listDebts,
} from "@/server/finance/finance-service";
import {
  AGING_BUCKETS,
  AGING_BUCKET_LABEL,
  type AgingBucket,
} from "@/server/finance/payment-rules";
import { formatAmount, formatDate } from "@/lib/format";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { Pager } from "@/components/Pager";
import { DebtsFilters } from "@/components/finance/DebtsFilters";
import { DebtsTable, type DebtTableRow } from "@/components/finance/DebtsTable";

export const metadata = { title: "Créances — FEREDRON" };

const PER_PAGE = 20;

export default async function DebtsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "debts.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="les créances" />;
  }

  const orgId = ctx.organization.id;
  const currency = ctx.organization.currency;
  const canWrite = can(ctx.role, "debts.write");
  const scopeWhere = orderScopeWhere(ctx.role, ctx.user.id);
  const now = new Date();

  const bucketParam = AGING_BUCKETS.includes(sp.bucket as AgingBucket)
    ? (sp.bucket as AgingBucket)
    : undefined;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const minAmount = sp.min ? Number(sp.min) || undefined : undefined;

  const [overview, list] = await Promise.all([
    getDebtsOverview(orgId, { scopeWhere, now }),
    listDebts(orgId, {
      scopeWhere,
      filters: {
        search: sp.q,
        onlyOverdue: sp.overdue === "1",
        bucket: bucketParam,
        minAmount,
      },
      page,
      pageSize: PER_PAGE,
      now,
    }),
  ]);

  const rows: DebtTableRow[] = list.rows.map((r) => ({
    orderId: r.orderId,
    reference: r.reference,
    customerId: r.customerId,
    customerName: r.customerName,
    currency: r.currency,
    totalAmount: r.totalAmount,
    amountPaid: r.amountPaid,
    balanceDue: r.balanceDue,
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    daysOverdue: r.daysOverdue,
    isOverdue: r.isOverdue,
    bucket: r.bucket,
  }));

  const tiles: Array<[string, string, string]> = [
    [
      "Total créances",
      formatAmount(overview.totalOutstanding, currency),
      `${overview.orderCount} commande${overview.orderCount > 1 ? "s" : ""}`,
    ],
    [
      "En retard",
      formatAmount(overview.overdueOutstanding, currency),
      "échéance dépassée",
    ],
    [
      "À échoir",
      formatAmount(overview.notDueOutstanding, currency),
      "pas encore dues",
    ],
    [
      "Clients débiteurs",
      String(overview.debtorCount),
      overview.oldestDueDate
        ? `plus ancienne : ${formatDate(overview.oldestDueDate)}`
        : "aucune échéance dépassée",
    ],
  ];

  return (
    <>
      <PageHeader
        title="Créances"
        subtitle={
          canSeeAllCrm(ctx.role)
            ? "Qui doit quoi, depuis quand, sur quelle commande. Calculé à partir des commandes livrées et des paiements."
            : "Les créances de vos clients assignés et de vos commandes."
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {tiles.map(([label, value, note]) => (
          <Card key={label} style={{ padding: "20px 22px" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.07em",
                color: "var(--text-3)",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              {label}
            </div>
            <div
              className="tnum"
              style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1 }}
            >
              {value}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
              {note}
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 24, padding: "16px 20px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.07em",
            color: "var(--text-3)",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Ancienneté des créances
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {AGING_BUCKETS.map((b) => (
            <div key={b} style={{ minWidth: 96 }}>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                {AGING_BUCKET_LABEL[b]}
              </div>
              <div
                className="tnum"
                style={{ fontFamily: "var(--font-display)", fontSize: 18 }}
              >
                {formatAmount(overview.buckets[b].amount, currency)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {overview.buckets[b].count} cmd
              </div>
            </div>
          ))}
        </div>
      </Card>

      <DebtsFilters />

      {list.total === 0 ? (
        <EmptyState
          title="Aucune créance"
          message="Aucune commande livrée avec un solde restant ne correspond à ces filtres."
        />
      ) : (
        <>
          <DebtsTable organizationId={orgId} rows={rows} canWrite={canWrite} />
          <Pager
            basePath="/debts"
            searchParams={sp}
            page={list.page}
            total={list.total}
            perPage={PER_PAGE}
          />
        </>
      )}
    </>
  );
}
