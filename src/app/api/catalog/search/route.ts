import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getOrgContext } from "@/server/tenant/context";
import { can } from "@/server/rbac/permissions";
import { prisma } from "@/server/db/client";
import { getStockSnapshots } from "@/server/stock/stock-service";
import { productUnitLabel } from "@/server/stock/units";

export const dynamic = "force-dynamic";

/** Recherche produit serveur pour le formulaire de commande. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const ctx = await getOrgContext(user);
  if (!ctx) return NextResponse.json({ error: "no-organization" }, { status: 403 });
  if (!can(ctx.role, "catalog.read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  const products = await prisma.product.findMany({
    where: {
      organizationId: ctx.organization.id,
      status: "ACTIVE",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 15,
  });

  const snapshots = await getStockSnapshots(
    ctx.organization.id,
    products.map((p) => ({
      id: p.id,
      alertThreshold: p.alertThreshold,
      purchasePrice: p.purchasePrice,
    })),
  );

  return NextResponse.json({
    results: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      salePrice: p.salePrice,
      unitLabel: productUnitLabel(p.unit, p.unitLabel),
      available: snapshots.get(p.id)?.available ?? 0,
    })),
  });
}
