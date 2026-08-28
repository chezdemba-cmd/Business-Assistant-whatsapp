import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { StockMovementForm } from "@/components/stock/StockMovementForm";

export const metadata = { title: "Mouvement de stock — Djeli" };

export default async function NewMovementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "stock.write")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="les mouvements de stock" />;
  }

  const products = await prisma.product.findMany({
    where: { organizationId: ctx.organization.id, status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true },
  });

  return (
    <>
      <Link
        href="/stock"
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← Stock
      </Link>
      <PageHeader
        title="Mouvement de stock"
        subtitle="Le stock ne se corrige pas à la main. Chaque variation est un mouvement typé, conservé dans l'historique."
      />
      {products.length === 0 ? (
        <EmptyState
          title="Aucun produit"
          message="Créez d'abord un produit dans le catalogue."
          action={
            can(ctx.role, "catalog.write") ? (
              <Link className="dj-btn dj-btn--primary" href="/catalog/new">
                Nouveau produit
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <StockMovementForm
            organizationId={ctx.organization.id}
            products={products}
            defaultProductId={sp.product}
          />
        </Card>
      )}
    </>
  );
}
