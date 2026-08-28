"use client";

import { useEffect, useRef, useState } from "react";
import { formatAmount } from "@/lib/format";
import { Input } from "@/components/ui";

export type OrderLine = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  available: number;
};

type SearchResult = {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  unitLabel: string;
  available: number;
};

export function OrderLines({
  lines,
  onChange,
  currency,
}: {
  lines: OrderLine[];
  onChange: (next: OrderLine[]) => void;
  currency: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const res = await fetch(
        `/api/catalog/search?q=${encodeURIComponent(query)}`,
      );
      if (!res.ok) {
        setResults([]);
        return;
      }
      const json = (await res.json()) as { results: SearchResult[] };
      setResults(json.results);
    }, 250);
    return () => window.clearTimeout(timer.current);
  }, [query]);

  function addProduct(r: SearchResult) {
    const existing = lines.find((l) => l.productId === r.id);
    if (existing) {
      onChange(
        lines.map((l) =>
          l.productId === r.id ? { ...l, quantity: l.quantity + 1 } : l,
        ),
      );
    } else {
      onChange([
        ...lines,
        {
          productId: r.id,
          name: r.name,
          sku: r.sku,
          unitPrice: r.salePrice,
          quantity: 1,
          available: r.available,
        },
      ]);
    }
    setQuery("");
    setOpen(false);
  }

  function setQty(productId: string, quantity: number) {
    onChange(
      lines.map((l) =>
        l.productId === productId
          ? { ...l, quantity: Math.max(1, Math.trunc(quantity) || 1) }
          : l,
      ),
    );
  }

  function remove(productId: string) {
    onChange(lines.filter((l) => l.productId !== productId));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ position: "relative" }}>
        <Input
          value={query}
          placeholder="Ajouter un produit : nom ou SKU…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setOpen(true);
          }}
        />
        {open && results.length > 0 ? (
          <div
            style={{
              position: "absolute",
              zIndex: 20,
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 18,
              boxShadow: "var(--shadow-card)",
              overflow: "hidden",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => addProduct(r)}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  border: 0,
                  borderBottom: "1px solid var(--border-soft)",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {r.sku} · dispo {r.available}
                  </div>
                </div>
                <span className="tnum" style={{ fontWeight: 700 }}>
                  {formatAmount(r.salePrice, currency)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
          Aucun article. Recherchez un produit ci-dessus.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {lines.map((l) => {
            const over = l.quantity > l.available;
            return (
              <div
                key={l.productId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border-soft)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{l.name}</div>
                  <div
                    className="mono"
                    style={{ fontSize: 11, color: over ? "var(--warn-fg)" : "var(--text-3)" }}
                  >
                    {l.sku} · {formatAmount(l.unitPrice, currency)} · dispo {l.available}
                    {over ? " — insuffisant" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    className="dj-btn dj-btn--outline"
                    style={{ height: 32, width: 32, padding: 0 }}
                    onClick={() => setQty(l.productId, l.quantity - 1)}
                  >
                    −
                  </button>
                  <input
                    className="dj-input tnum"
                    inputMode="numeric"
                    value={l.quantity}
                    onChange={(e) => setQty(l.productId, Number(e.currentTarget.value))}
                    style={{ width: 60, height: 32, textAlign: "center", padding: 0 }}
                  />
                  <button
                    type="button"
                    className="dj-btn dj-btn--outline"
                    style={{ height: 32, width: 32, padding: 0 }}
                    onClick={() => setQty(l.productId, l.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <span
                  className="tnum"
                  style={{ fontWeight: 700, minWidth: 110, textAlign: "right" }}
                >
                  {formatAmount(l.unitPrice * l.quantity, currency)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(l.productId)}
                  className="dj-btn dj-btn--ghost"
                  style={{ height: 32, padding: "0 8px", fontSize: 12 }}
                >
                  Retirer
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function serializeLines(lines: OrderLine[]): string {
  return JSON.stringify(
    lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
  );
}

export function linesSubtotal(lines: OrderLine[]): number {
  return lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
}
