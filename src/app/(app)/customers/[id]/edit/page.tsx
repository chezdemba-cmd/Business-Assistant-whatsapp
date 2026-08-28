import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { canAccessCustomer } from "@/server/crm/scope";
import { PageHeader, Card } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { CustomerForm } from "@/components/customers/CustomerForm";

export const metadata = { title: "Modifier le client — Djeli" };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "customers.write")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="la modification de clients" />;
  }

  const [customer, members] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, organizationId: ctx.organization.id },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: ctx.organization.id, status: { not: "SUSPENDED" } },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  if (!customer) notFound();
  if (!canAccessCustomer(ctx.role, ctx.user.id, customer)) notFound();

  return (
    <>
      <Link
        href={`/customers/${customer.id}`}
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← {customer.displayName}
      </Link>
      <PageHeader title="Modifier le client" />
      <Card>
        <CustomerForm
          mode="edit"
          organizationId={ctx.organization.id}
          members={members.map((m) => ({
            id: m.userId,
            name: `${m.user.firstName} ${m.user.lastName}`,
          }))}
          customer={{
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            businessName: customer.businessName,
            phone: customer.phone,
            email: customer.email,
            customerType: customer.customerType,
            address: customer.address,
            city: customer.city,
            area: customer.area,
            notes: customer.notes,
            assignedToUserId: customer.assignedToUserId,
          }}
        />
      </Card>
    </>
  );
}
