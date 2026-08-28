"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductUnit } from "@prisma/client";
import {
  createProductAction,
  updateProductAction,
} from "@/server/actions/catalog.actions";
import { PRODUCT_UNITS, productUnitLabel } from "@/server/stock/units";
import { marginOf } from "@/server/stock/movement-rules";
import { formatAmount, formatPercent } from "@/lib/format";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input, Select } from "@/components/ui";

export type ProductFormData = {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  unit: ProductUnit;
  unitLabel: string | null;
  salePrice: number;
  purchasePrice: number | null;
  alertThreshold: number;
  supplierName: string | null;
  barcode: string | null;
  description: string | null;
  photoUrl: string | null;
};

function toInt(v: string): number | null {
  const n = Number(v.replace(/\s/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function ProductForm({
  organizationId,
  currency,
  categories,
  mode,
  product,
}: {
  organizationId: string;
  currency: string;
  categories: Array<{ id: string; name: string }>;
  mode: "create" | "edit";
  product?: ProductFormData;
}) {
  const router = useRouter();
  const action = mode === "create" ? createProductAction : updateProductAction;
  const [state, formAction] = useActionState(action, null);

  const [sale, setSale] = useState(String(product?.salePrice ?? ""));
  const [purchase, setPurchase] = useState(
    product?.purchasePrice != null ? String(product.purchasePrice) : "",
  );
  const [unit, setUnit] = useState<ProductUnit>(product?.unit ?? "UNIT");

  const margin = useMemo(() => {
    const s = toInt(sale);
    const p = purchase.trim() === "" ? null : toInt(purchase);
    if (s == null) return null;
    return marginOf(s, p);
  }, [sale, purchase]);

  useEffect(() => {
    if (state?.ok) {
      router.push(`/catalog/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="dj-stack" style={{ maxWidth: 760 }}>
      <Feedback state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />
      {mode === "edit" && product ? (
        <input type="hidden" name="productId" value={product.id} />
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
        <Field label="Nom du produit *" htmlFor="p-name" error={fieldError(state, "name")}>
          <Input
            id="p-name"
            name="name"
            required
            defaultValue={product?.name ?? ""}
            placeholder="Sucre cristallisé 50 kg"
          />
        </Field>
        <Field
          label="SKU *"
          htmlFor="p-sku"
          error={fieldError(state, "sku")}
          hint="Normalisé automatiquement (SUC-050)."
        >
          <Input
            id="p-sku"
            name="sku"
            required
            defaultValue={product?.sku ?? ""}
            className="mono"
            placeholder="SUC-050"
          />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Catégorie" htmlFor="p-cat" error={fieldError(state, "categoryId")}>
          <Select id="p-cat" name="categoryId" defaultValue={product?.categoryId ?? ""}>
            <option value="">Sans catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Unité *" htmlFor="p-unit">
            <Select
              id="p-unit"
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.currentTarget.value as ProductUnit)}
            >
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {productUnitLabel(u)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Libellé (si Autre)" htmlFor="p-unitlabel">
            <Input
              id="p-unitlabel"
              name="unitLabel"
              defaultValue={product?.unitLabel ?? ""}
              disabled={unit !== "OTHER"}
              placeholder="fût, casier…"
            />
          </Field>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Field label="Prix de vente *" htmlFor="p-sale" error={fieldError(state, "salePrice")}>
          <Input
            id="p-sale"
            name="salePrice"
            required
            inputMode="numeric"
            className="tnum"
            value={sale}
            onChange={(e) => setSale(e.currentTarget.value)}
            placeholder="31500"
          />
        </Field>
        <Field
          label="Prix d'achat"
          htmlFor="p-purchase"
          error={fieldError(state, "purchasePrice")}
        >
          <Input
            id="p-purchase"
            name="purchasePrice"
            inputMode="numeric"
            className="tnum"
            value={purchase}
            onChange={(e) => setPurchase(e.currentTarget.value)}
            placeholder="27200"
          />
        </Field>
        <Field label="Marge (calculée)" htmlFor="p-margin">
          <div
            className="dj-input tnum"
            style={{
              display: "flex",
              alignItems: "center",
              background: margin ? "var(--ok-bg)" : "var(--card-alt)",
              color: margin ? "var(--ok-fg)" : "var(--text-3)",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {margin
              ? `${formatAmount(margin.amount, currency)} · ${formatPercent(margin.percent)}`
              : "—"}
          </div>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {mode === "create" ? (
          <Field
            label="Stock initial"
            htmlFor="p-init"
            error={fieldError(state, "initialStock")}
            hint="Crée un mouvement INITIAL."
          >
            <Input
              id="p-init"
              name="initialStock"
              inputMode="numeric"
              className="tnum"
              defaultValue="0"
            />
          </Field>
        ) : (
          <Field label="Stock" htmlFor="p-init-ro" hint="Modifié via les mouvements.">
            <Input id="p-init-ro" className="dj-input--readonly" value="voir la fiche" readOnly disabled />
          </Field>
        )}
        <Field
          label="Seuil d'alerte"
          htmlFor="p-threshold"
          error={fieldError(state, "alertThreshold")}
        >
          <Input
            id="p-threshold"
            name="alertThreshold"
            inputMode="numeric"
            className="tnum"
            defaultValue={String(product?.alertThreshold ?? 0)}
          />
        </Field>
        <Field label="Code-barres" htmlFor="p-barcode" error={fieldError(state, "barcode")}>
          <Input
            id="p-barcode"
            name="barcode"
            className="mono"
            defaultValue={product?.barcode ?? ""}
          />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Fournisseur" htmlFor="p-supplier" error={fieldError(state, "supplierName")}>
          <Input
            id="p-supplier"
            name="supplierName"
            defaultValue={product?.supplierName ?? ""}
            placeholder="Sucrerie de Ségou"
          />
        </Field>
        <Field
          label="Photo (URL)"
          htmlFor="p-photo"
          error={fieldError(state, "photoUrl")}
          hint="Optionnel — placeholder affiché sinon."
        >
          <Input
            id="p-photo"
            name="photoUrl"
            type="url"
            defaultValue={product?.photoUrl ?? ""}
            placeholder="https://…"
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="p-desc" error={fieldError(state, "description")}>
        <textarea
          id="p-desc"
          name="description"
          className="dj-input"
          rows={3}
          style={{ height: "auto", padding: "12px 18px", resize: "vertical" }}
          defaultValue={product?.description ?? ""}
        />
      </Field>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <SubmitButton>
          {mode === "create" ? "Créer le produit" : "Enregistrer"}
        </SubmitButton>
        <a
          href={mode === "edit" && product ? `/catalog/${product.id}` : "/catalog"}
          style={{ fontSize: 14, color: "var(--text-3)" }}
        >
          Annuler
        </a>
      </div>
    </form>
  );
}
