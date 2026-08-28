import Link from "next/link";
import type { Prisma, StockMovementType } from "@prisma/client";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import {
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABEL,
} from "@/server/stock/movement-rules";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { Pager } from "@/components/Pager";
import { ReverseMovementButton } from "@/components/stock/ReverseMovementButton";
import { MovementFilters } from "./MovementFilters";

export const metadata = { title: "Mouvements de stock — Djeli" };

const PER_PAGE = 25;

function endOfDay(d: string): Date {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
}

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "stock.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="les mouvements de stock" />;
  }
  const orgId = ctx.organization.id;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const typeParam = MOVEMENT_TYPES.includes(sp.type as never)
    ? (sp.type as StockMovementType)
    : undefined;

  const dateFilter: Prisma.DateTimeFilter = {};
  if (sp.from) dateFilter.gte = new Date(sp.from);
  if (sp.to) dateFilter.lte = endOfDay(sp.to);

  const where: Prisma.StockMovementWhereInput = {
    organizationId: orgId,
    ...(sp.product ? { productId: sp.product } : {}),
    ...(typeParam ? { type: typeParam } : {}),
    ...(sp.from || sp.to ? { createdAt: dateFilter } : {}),
  };

  const [products, total, movements] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        actor: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const canWrite = can(ctx.role, "stock.write");

  return (
    <>
      <PageHeader
        title="Mouvements de stock"
        subtitle="Historique immuable. Une erreur se corrige par un mouvement compensatoire."
        actions={
          canWrite ? (
            <Link className="dj-btn dj-btn--primary" href="/stock/new">
              Nouveau mouvement
            </Link>
          ) : undefined
        }
      />

      <MovementFilters products={products} />

      {total === 0 ? (
        <EmptyState
          title="Aucun mouvement"
          message="Aucun mouvement ne correspond à ces filtres."
        />
      ) : (
        <>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "var(--panel)" }}>
                    {["Date", "Type", "Produit", "Qté", "Auteur", "Motif / réf.", ""].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
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
                  {movements.map((m) => (
                    <tr key={m.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                      <td style={{ padding: "13px 16px", color: "var(--text-3)", fontSize: 13, whiteSpace: "nowrap" }}>
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <Badge>{MOVEMENT_TYPE_LABEL[m.type]}</Badge>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <Link href={`/catalog/${m.product.id}`} style={{ fontWeight: 700 }}>
                          {m.product.name}
                        </Link>
                        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {m.product.sku}
                        </div>
                      </td>
                      <td className="tnum" style={{ padding: "13px 16px", fontWeight: 700 }}>
                        {m.quantity}
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--text-2)" }}>
                        {m.actor ? `${m.actor.firstName} ${m.actor.lastName}` : "Système"}
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 13 }}>
                        {m.reason ?? "—"}
                        {m.reference ? (
                          <span className="mono" style={{ color: "var(--text-3)" }}>
                            {" "}· {m.reference}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: "13px 16px", textAlign: "right" }}>
                        {canWrite && m.type !== "INITIAL" ? (
                          <ReverseMovementButton
                            organizationId={orgId}
                            movementId={m.id}
                            label={MOVEMENT_TYPE_LABEL[m.type]}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager
            basePath="/stock/movements"
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
