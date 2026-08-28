import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import {
  getStockSnapshots,
  getStockSummary,
} from "@/server/stock/stock-service";
import { formatAmount } from "@/lib/format";
import { Card, PageHeader, StockStateBadge, EmptyState } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";

export const metadata = { title: "Stock — Djeli" };

const COMPUTED_STATES = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as const;

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "stock.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="le stock" />;
  }
  const orgId = ctx.organization.id;
  const currency = ctx.organization.currency;
  const stateFilter = sp.state ?? "";

  const [summary, products] = await Promise.all([
    getStockSummary(orgId),
    prisma.product.findMany({
      where: { organizationId: orgId, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);
  const snapshots = await getStockSnapshots(
    orgId,
    products.map((p) => ({
      id: p.id,
      alertThreshold: p.alertThreshold,
      purchasePrice: p.purchasePrice,
    })),
  );

  let rows = products.map((p) => ({ p, s: snapshots.get(p.id) }));
  if ((COMPUTED_STATES as readonly string[]).includes(stateFilter)) {
    rows = rows.filter((r) => r.s?.state === stateFilter);
  }

  const tiles: Array<[string, string, string]> = [
    ["Produits", String(summary.productCount), "non archivés"],
    ["En stock", String(summary.inStock), ""],
    ["Stock faible", String(summary.lowStock), "sous le seuil"],
    ["Ruptures", String(summary.outOfStock), summary.incoherent ? `${summary.incoherent} incohérent(s)` : ""],
    [
      "Valeur du stock",
      formatAmount(summary.stockValue, currency),
      "estimée au prix d'achat",
    ],
  ];

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="Niveaux calculés depuis les mouvements. Le réservé correspond aux réservations actives."
        actions={
          can(ctx.role, "stock.write") ? (
            <Link className="dj-btn dj-btn--primary" href="/stock/new">
              Nouveau mouvement
            </Link>
          ) : undefined
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {tiles.map(([label, value, note]) => (
          <Card key={label} style={{ padding: "20px 22px" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.07em",
                color: "var(--text-3)",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              {label}
            </div>
            <div
              className="tnum"
              style={{ fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1 }}
            >
              {value}
            </div>
            {note ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
                {note}
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {[
          ["", `Tous · ${products.length}`],
          ["IN_STOCK", `En stock · ${summary.inStock}`],
          ["LOW_STOCK", `Stock faible · ${summary.lowStock}`],
          ["OUT_OF_STOCK", `Rupture · ${summary.outOfStock}`],
        ].map(([value, label]) => (
          <Link
            key={value || "all"}
            href={value ? `/stock?state=${value}` : "/stock"}
            className="dj-badge"
            style={{
              textDecoration: "none",
              background: stateFilter === value ? "var(--ink)" : "var(--card-alt)",
              color: stateFilter === value ? "var(--bg)" : "var(--text-2)",
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun produit"
          message="Ajoutez des produits au catalogue pour suivre leur stock."
          action={
            can(ctx.role, "catalog.write") ? (
              <Link className="dj-btn dj-btn--primary" href="/catalog/new">
                Nouveau produit
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--panel)" }}>
                  {["Produit", "Physique", "Réservé", "Disponible", "Seuil", "État"].map(
                    (h, i) => (
                      <th
                        key={h}
                        style={{
                          textAlign: i === 0 || i === 5 ? "left" : "right",
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
                {rows.map(({ p, s }) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <Link href={`/catalog/${p.id}`} style={{ fontWeight: 700 }}>
                        {p.name}
                      </Link>
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                        SKU {p.sku}
                      </div>
                    </td>
                    <td className="tnum" style={{ padding: "14px 16px", textAlign: "right" }}>
                      {s?.physical ?? 0}
                    </td>
                    <td
                      className="tnum"
                      style={{ padding: "14px 16px", textAlign: "right", color: "var(--text-3)" }}
                    >
                      {s?.reserved ?? 0}
                    </td>
                    <td
                      className="tnum"
                      style={{
                        padding: "14px 16px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: s?.incoherent ? "var(--warn-fg)" : "var(--text)",
                      }}
                    >
                      {s?.available ?? 0}
                    </td>
                    <td
                      className="tnum"
                      style={{ padding: "14px 16px", textAlign: "right", color: "var(--text-3)" }}
                    >
                      {p.alertThreshold}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {s ? (
                        <StockStateBadge state={s.state} label={s.stateLabel} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
