import Link from "next/link";
import type { CustomerType, Prisma } from "@prisma/client";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { customerScopeWhere, canSeeAllCrm } from "@/server/crm/scope";
import { getCustomerStatsMany } from "@/server/crm/customer-service";
import { CUSTOMER_TYPE_LABEL } from "@/lib/labels";
import { formatAmount, formatDate } from "@/lib/format";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { Pager } from "@/components/Pager";
import { CustomersFilters } from "@/components/customers/CustomersFilters";

export const metadata = { title: "Clients — Djeli" };

const PER_PAGE = 20;
const CUSTOMER_TYPE_VALUES = Object.keys(CUSTOMER_TYPE_LABEL);

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "customers.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="les clients" />;
  }
  const orgId = ctx.organization.id;
  const broad = canSeeAllCrm(ctx.role);
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const q = (sp.q ?? "").trim();
  const typeParam = CUSTOMER_TYPE_VALUES.includes(sp.type ?? "")
    ? (sp.type as CustomerType)
    : undefined;
  const statusParam = sp.status ?? "";
  const assignee = sp.assignee ?? "";

  const where: Prisma.CustomerWhereInput = {
    organizationId: orgId,
    ...customerScopeWhere(ctx.role, ctx.user.id),
    ...(statusParam === "ALL"
      ? {}
      : statusParam === "INACTIVE"
        ? { status: "INACTIVE" }
        : statusParam === "ARCHIVED"
          ? { status: "ARCHIVED" }
          : { status: { not: "ARCHIVED" } }),
    ...(typeParam ? { customerType: typeParam } : {}),
    ...(broad && assignee === "NONE" ? { assignedToUserId: null } : {}),
    ...(broad && assignee && assignee !== "NONE"
      ? { assignedToUserId: assignee }
      : {}),
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: "insensitive" } },
            { businessName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { area: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [members, total, customers] = await Promise.all([
    broad
      ? prisma.organizationMember.findMany({
          where: { organizationId: orgId, status: { not: "SUSPENDED" } },
          include: { user: { select: { firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { displayName: "asc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  const stats = await getCustomerStatsMany(
    orgId,
    customers.map((c) => c.id),
  );
  const memberOptions = members.map((m) => ({
    id: m.userId,
    name: `${m.user.firstName} ${m.user.lastName}`,
  }));

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={
          broad
            ? "Tous les clients de l'entreprise."
            : "Les clients qui vous sont assignés."
        }
        actions={
          can(ctx.role, "customers.write") ? (
            <Link className="dj-btn dj-btn--primary" href="/customers/new">
              Nouveau client
            </Link>
          ) : undefined
        }
      />

      <CustomersFilters members={memberOptions} showAssignee={broad} />

      {total === 0 ? (
        <EmptyState
          title={q || typeParam || statusParam ? "Aucun résultat" : "Aucun client"}
          message={
            q || typeParam || statusParam
              ? "Aucun client ne correspond à ces filtres."
              : "Créez votre premier client, ou il sera créé automatiquement au premier message WhatsApp (Phase 4)."
          }
          action={
            can(ctx.role, "customers.write") && !(q || typeParam || statusParam) ? (
              <Link className="dj-btn dj-btn--primary" href="/customers/new">
                Nouveau client
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "var(--panel)" }}>
                    {["Client", "Boutique", "Type", "Zone", "Cmd.", "Total achats", "Dernière"].map(
                      (h, i) => (
                        <th
                          key={h}
                          style={{
                            textAlign: i >= 4 && i <= 5 ? "right" : "left",
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
                  {customers.map((c) => {
                    const s = stats.get(c.id);
                    return (
                      <tr key={c.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                        <td style={{ padding: "14px 16px" }}>
                          <Link href={`/customers/${c.id}`} style={{ fontWeight: 700 }}>
                            {c.displayName}
                          </Link>
                          <div className="tnum" style={{ fontSize: 12, color: "var(--text-3)" }}>
                            {c.phone ?? "—"}
                            {c.status === "ARCHIVED" ? " · archivé" : ""}
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-2)" }}>
                          {c.businessName ?? "—"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {c.customerType ? (
                            <Badge>{CUSTOMER_TYPE_LABEL[c.customerType]}</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-2)" }}>
                          {c.area ?? "—"}
                        </td>
                        <td className="tnum" style={{ padding: "14px 16px", textAlign: "right" }}>
                          {s?.orderCount ?? 0}
                        </td>
                        <td
                          className="tnum"
                          style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700 }}
                        >
                          {formatAmount(s?.totalSpent ?? 0, ctx.organization.currency)}
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-3)", fontSize: 13 }}>
                          {s?.lastOrderAt ? formatDate(s.lastOrderAt) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager
            basePath="/customers"
            searchParams={sp}
            page={page}
            total={total}
            perPage={PER_PAGE}
          />
        </>
      )}
    </>
  );
}
