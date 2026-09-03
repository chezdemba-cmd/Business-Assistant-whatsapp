import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { PageHeader, Card } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { ProductForm } from "@/components/catalog/ProductForm";

export const metadata = { title: "Modifier le produit — FEREDRON" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "catalog.write")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="la modification de produits" />;
  }

  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, organizationId: ctx.organization.id },
    }),
    prisma.productCategory.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!product) notFound();

  return (
    <>
      <Link
        href={`/catalog/${product.id}`}
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← {product.name}
      </Link>
      <PageHeader title="Modifier le produit" />
      <Card>
        <ProductForm
          mode="edit"
          organizationId={ctx.organization.id}
          currency={ctx.organization.currency}
          categories={categories}
          product={{
            id: product.id,
            name: product.name,
            sku: product.sku,
            categoryId: product.categoryId,
            unit: product.unit,
            unitLabel: product.unitLabel,
            salePrice: product.salePrice,
            purchasePrice: product.purchasePrice,
            alertThreshold: product.alertThreshold,
            supplierName: product.supplierName,
            barcode: product.barcode,
            description: product.description,
            photoUrl: product.photoUrl,
          }}
        />
      </Card>
    </>
  );
}
