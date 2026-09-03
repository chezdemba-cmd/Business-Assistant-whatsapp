import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { getStockSnapshot } from "@/server/stock/stock-service";
import { marginOf, MOVEMENT_TYPE_LABEL } from "@/server/stock/movement-rules";
import { productUnitLabel } from "@/server/stock/units";
import { formatAmount, formatPercent, formatDateTime } from "@/lib/format";
import { Card, PageHeader, StockStateBadge, ProductPhoto, Badge } from "@/components/ui";
import { ArchiveToggle } from "@/components/catalog/ProductActions";
import { ReverseMovementButton } from "@/components/stock/ReverseMovementButton";

export const metadata = { title: "Produit — FEREDRON" };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "catalog.read")) notFound();

  const product = await prisma.product.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { category: { select: { name: true } } },
  });
  if (!product) notFound();

  const [snapshot, movements] = await Promise.all([
    getStockSnapshot(ctx.organization.id, {
      id: product.id,
      alertThreshold: product.alertThreshold,
      purchasePrice: product.purchasePrice,
    }),
    prisma.stockMovement.findMany({
      where: { organizationId: ctx.organization.id, productId: product.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { actor: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const currency = ctx.organization.currency;
  const margin = marginOf(product.salePrice, product.purchasePrice);
  const canWrite = can(ctx.role, "catalog.write");
  const canStock = can(ctx.role, "stock.write");

  return (
    <>
      <Link
        href="/catalog"
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← Catalogue
      </Link>

      <PageHeader
        title={product.name}
        subtitle={`SKU ${product.sku}${product.status === "ARCHIVED" ? " · archivé" : ""}`}
        actions={
          <>
            {canWrite ? (
              <Link
                className="dj-btn dj-btn--outline"
                href={`/catalog/${product.id}/edit`}
              >
                Modifier
              </Link>
            ) : null}
            {canStock && product.status !== "ARCHIVED" ? (
              <Link
                className="dj-btn dj-btn--primary"
                href={`/stock/new?product=${product.id}`}
              >
                Ajuster le stock
              </Link>
            ) : null}
            {canWrite ? (
              <ArchiveToggle
                organizationId={ctx.organization.id}
                productId={product.id}
                archived={product.status === "ARCHIVED"}
              />
            ) : null}
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <Card>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 22 }}>
              <ProductPhoto url={product.photoUrl} alt={product.name} size={150} radius={22} />
              <div style={{ minWidth: 200, flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  {product.category?.name ?? "Sans catégorie"}
                </div>
                <div
                  className="tnum"
                  style={{ fontFamily: "var(--font-display)", fontSize: 26 }}
                >
                  {formatAmount(product.salePrice, currency)}
                </div>
                <div style={{ marginTop: 10 }}>
                  <StockStateBadge state={snapshot.state} label={snapshot.stateLabel} />
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
                gap: 14,
                paddingTop: 20,
                borderTop: "1px solid var(--border)",
              }}
            >
              <Metric label="Stock physique" value={String(snapshot.physical)} />
              <Metric label="Réservé" value={String(snapshot.reserved)} />
              <Metric
                label="Disponible"
                value={String(snapshot.available)}
                warn={snapshot.incoherent}
              />
              <Metric label="Seuil d'alerte" value={String(product.alertThreshold)} />
            </div>
            {snapshot.incoherent ? (
              <div className="dj-alert dj-alert--error" style={{ marginTop: 14 }}>
                Stock disponible négatif — historique de mouvements/réservations
                incohérent. Vérifiez les mouvements de ce produit.
              </div>
            ) : null}
          </Card>

          <Card>
            <h3 style={{ fontSize: 21, margin: "0 0 16px" }}>Mouvements récents</h3>
            {movements.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
                Aucun mouvement pour ce produit.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {movements.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 0",
                      borderBottom: "1px solid var(--border-soft)",
                      flexWrap: "wrap",
                    }}
                  >
                    <Badge>{MOVEMENT_TYPE_LABEL[m.type]}</Badge>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 13 }}>
                        {m.reason ?? "—"}
                        {m.reference ? (
                          <span className="mono" style={{ color: "var(--text-3)" }}>
                            {" "}· {m.reference}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {formatDateTime(m.createdAt)} ·{" "}
                        {m.actor ? `${m.actor.firstName} ${m.actor.lastName}` : "Système"}
                      </div>
                    </div>
                    <span
                      className="tnum"
                      style={{ fontFamily: "var(--font-display)", fontSize: 16 }}
                    >
                      {m.quantity}
                    </span>
                    {canStock && m.type !== "INITIAL" ? (
                      <ReverseMovementButton
                        organizationId={ctx.organization.id}
                        movementId={m.id}
                        label={MOVEMENT_TYPE_LABEL[m.type]}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <h3 style={{ fontSize: 19, margin: "0 0 18px" }}>Fiche</h3>
          <dl style={{ display: "flex", flexDirection: "column", gap: 14, margin: 0, fontSize: 13 }}>
            <Row k="Statut" v={product.status} />
            <Row
              k="Unité de vente"
              v={productUnitLabel(product.unit, product.unitLabel)}
            />
            <Row k="Prix d'achat" v={formatAmount(product.purchasePrice, currency)} />
            <Row
              k="Marge"
              v={
                margin
                  ? `${formatAmount(margin.amount, currency)} · ${formatPercent(margin.percent)}`
                  : "—"
              }
            />
            <Row k="Fournisseur" v={product.supplierName ?? "—"} />
            <Row k="Code-barres" v={product.barcode ?? "—"} mono />
            <Row
              k="Valeur du stock"
              v={`${formatAmount(snapshot.value, currency)}`}
              hint="Estimée au prix d'achat courant"
            />
            {product.description ? (
              <div>
                <dt style={{ color: "var(--text-3)", fontWeight: 600, marginBottom: 2 }}>
                  Description
                </dt>
                <dd style={{ margin: 0, lineHeight: 1.5 }}>{product.description}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "var(--text-3)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        className="tnum"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 21,
          color: warn ? "var(--warn-fg)" : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  mono,
  hint,
}: {
  k: string;
  v: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <dt style={{ color: "var(--text-3)", fontWeight: 600, marginBottom: 2 }}>{k}</dt>
      <dd className={mono ? "mono" : undefined} style={{ margin: 0, fontWeight: 700 }}>
        {v}
      </dd>
      {hint ? (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</div>
      ) : null}
    </div>
  );
}
