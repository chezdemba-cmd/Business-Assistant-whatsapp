import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { getStockSnapshots } from "@/server/stock/stock-service";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { Pager } from "@/components/Pager";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CategoryQuickAdd } from "@/components/catalog/CategoryQuickAdd";

export const metadata = { title: "Catalogue — FEREDRON" };

const PER_PAGE = 12;
const CAP = 500;
const COMPUTED_STATES = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as const;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "catalog.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="le catalogue" />;
  }
  const orgId = ctx.organization.id;
  const canWrite = can(ctx.role, "catalog.write");

  const q = (sp.q ?? "").trim();
  const categoryId = sp.category ?? "";
  const stateFilter = sp.state ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where: Prisma.ProductWhereInput = {
    organizationId: orgId,
    ...(categoryId ? { categoryId } : {}),
    ...(stateFilter === "ARCHIVED"
      ? { status: "ARCHIVED" }
      : { status: { not: "ARCHIVED" } }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } },
            { supplierName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [categories, matching] = await Promise.all([
    prisma.productCategory.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      take: CAP,
    }),
  ]);

  const snapshots = await getStockSnapshots(
    orgId,
    matching.map((p) => ({
      id: p.id,
      alertThreshold: p.alertThreshold,
      purchasePrice: p.purchasePrice,
    })),
  );

  const isComputedState = (COMPUTED_STATES as readonly string[]).includes(
    stateFilter,
  );
  const filtered = isComputedState
    ? matching.filter((p) => snapshots.get(p.id)?.state === stateFilter)
    : matching;

  const total = filtered.length;
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      <PageHeader
        title="Catalogue"
        subtitle="Le stock affiché est calculé depuis les mouvements, jamais saisi directement."
        actions={
          <div className="catalog-actions">
            {can(ctx.role, "stock.write") ? (
              <Link className="dj-btn dj-btn--outline" href="/stock/new">
                Ajouter du stock
              </Link>
            ) : null}
            {canWrite ? (
              <Link className="dj-btn dj-btn--primary" href="/catalog/new">
                Nouveau produit
              </Link>
            ) : null}
          </div>
        }
      />

      <CatalogFilters categories={categories} />

      {total === 0 ? (
        <EmptyState
          title={q || categoryId || stateFilter ? "Aucun résultat" : "Aucun produit"}
          message={
            q || categoryId || stateFilter
              ? "Aucun produit ne correspond à ces filtres."
              : "Créez votre premier produit pour démarrer le catalogue."
          }
          action={
            canWrite && !(q || categoryId || stateFilter) ? (
              <Link className="dj-btn dj-btn--primary" href="/catalog/new">
                Nouveau produit
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
              gap: 16,
            }}
          >
            {pageItems.map((p) => {
              const snap = snapshots.get(p.id);
              if (!snap) return null;
              return (
                <ProductCard
                  key={p.id}
                  currency={ctx.organization.currency}
                  snapshot={snap}
                  product={{
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    categoryName: p.category?.name ?? null,
                    salePrice: p.salePrice,
                    photoUrl: p.photoUrl,
                    status: p.status,
                  }}
                />
              );
            })}
          </div>
          <Pager
            basePath="/catalog"
            searchParams={sp}
            page={page}
            total={total}
            perPage={PER_PAGE}
          />
        </>
      )}

      {canWrite ? (
        <details className="catalog-category-manager">
          <summary>Gérer les catégories ({categories.length})</summary>
          <Card style={{ padding: 16 }}>
            <CategoryQuickAdd organizationId={orgId} />
          </Card>
        </details>
      ) : null}
    </>
  );
}
