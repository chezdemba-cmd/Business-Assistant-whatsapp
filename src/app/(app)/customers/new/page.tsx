import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { PageHeader, Card } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { CustomerForm } from "@/components/customers/CustomerForm";

export const metadata = { title: "Nouveau client — Djeli" };

export default async function NewCustomerPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "customers.write")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="la création de clients" />;
  }
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: ctx.organization.id, status: { not: "SUSPENDED" } },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  return (
    <>
      <Link
        href="/customers"
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← Clients
      </Link>
      <PageHeader title="Nouveau client" />
      <Card>
        <CustomerForm
          mode="create"
          organizationId={ctx.organization.id}
          members={members.map((m) => ({
            id: m.userId,
            name: `${m.user.firstName} ${m.user.lastName}`,
          }))}
        />
      </Card>
    </>
  );
}
