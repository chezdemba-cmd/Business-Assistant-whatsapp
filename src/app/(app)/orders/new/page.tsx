import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { customerScopeWhere } from "@/server/crm/scope";
import { PageHeader, EmptyState } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { NewOrderForm } from "@/components/orders/NewOrderForm";

export const metadata = { title: "Nouvelle commande — FEREDRON" };

export default async function NewOrderPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "orders.write")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="la création de commandes" />;
  }

  const customers = await prisma.customer.findMany({
    where: {
      organizationId: ctx.organization.id,
      status: { not: "ARCHIVED" },
      ...customerScopeWhere(ctx.role, ctx.user.id),
    },
    orderBy: { displayName: "asc" },
    take: 300,
    select: { id: true, displayName: true, phone: true },
  });

  return (
    <>
      <Link
        href="/orders"
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← Commandes
      </Link>
      <PageHeader title="Nouvelle commande" />
      {customers.length === 0 && !can(ctx.role, "customers.write") ? (
        <EmptyState
          title="Aucun client accessible"
          message="Aucun client ne vous est assigné. Demandez à un responsable de vous en assigner."
        />
      ) : (
        <NewOrderForm
          organizationId={ctx.organization.id}
          currency={ctx.organization.currency}
          customers={customers.map((c) => ({
            id: c.id,
            label: c.phone ? `${c.displayName} · ${c.phone}` : c.displayName,
          }))}
        />
      )}
    </>
  );
}
