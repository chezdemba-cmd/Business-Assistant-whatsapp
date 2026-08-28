import Link from "next/link";
import { StockStateBadge, ProductPhoto } from "@/components/ui";
import { formatAmount } from "@/lib/format";
import type { StockSnapshot } from "@/server/stock/stock-service";

export type ProductCardData = {
  id: string;
  name: string;
  sku: string;
  categoryName: string | null;
  salePrice: number;
  photoUrl: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
};

export function ProductCard({
  product,
  snapshot,
  currency,
}: {
  product: ProductCardData;
  snapshot: StockSnapshot;
  currency: string;
}) {
  return (
    <Link
      href={`/catalog/${product.id}`}
      className="dj-card"
      style={{
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        textDecoration: "none",
        color: "inherit",
        opacity: product.status === "ARCHIVED" ? 0.6 : 1,
      }}
    >
      <ProductPhoto url={product.photoUrl} alt={product.name} size="100%" />
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--text-3)",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {product.categoryName ?? "Sans catégorie"}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, lineHeight: 1.2 }}>
          {product.name}
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
          SKU {product.sku}
          {product.status === "ARCHIVED" ? " · archivé" : ""}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          marginTop: "auto",
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>
            Prix de vente
          </div>
          <div
            className="tnum"
            style={{ fontFamily: "var(--font-display)", fontSize: 19 }}
          >
            {formatAmount(product.salePrice, currency)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <StockStateBadge state={snapshot.state} label={snapshot.stateLabel} />
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
            {snapshot.available} dispo · {snapshot.physical} phys.
          </div>
        </div>
      </div>
    </Link>
  );
}
