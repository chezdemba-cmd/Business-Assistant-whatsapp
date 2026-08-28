import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { PageHeader, Card } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { ProductForm } from "@/components/catalog/ProductForm";

export const metadata = { title: "Nouveau produit — Djeli" };

export default async function NewProductPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "catalog.write")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="la création de produits" />;
  }
  const categories = await prisma.productCategory.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <Link
        href="/catalog"
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← Catalogue
      </Link>
      <PageHeader
        title="Nouveau produit"
        subtitle="Le stock initial crée un mouvement INITIAL. Ensuite, il n'évolue que par des mouvements."
      />
      <Card>
        <ProductForm
          mode="create"
          organizationId={ctx.organization.id}
          currency={ctx.organization.currency}
          categories={categories}
        />
      </Card>
    </>
  );
}
