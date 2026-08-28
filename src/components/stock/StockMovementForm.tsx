"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recordStockMovementAction } from "@/server/actions/stock.actions";
import {
  MANUAL_MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABEL,
} from "@/server/stock/movement-rules";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input, Select } from "@/components/ui";

type Mode = "quantity" | "inventory";

export function StockMovementForm({
  organizationId,
  products,
  defaultProductId,
}: {
  organizationId: string;
  products: Array<{ id: string; name: string; sku: string }>;
  defaultProductId?: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(recordStockMovementAction, null);
  const [mode, setMode] = useState<Mode>("quantity");

  useEffect(() => {
    if (state?.ok && !state.data.unchanged) {
      router.push("/stock");
    }
  }, [state, router]);

  return (
    <form action={action} className="dj-stack" style={{ maxWidth: 640 }}>
      <Feedback state={state} />
      {state?.ok && state.data.unchanged ? (
        <div className="dj-alert dj-alert--info">
          Aucun écart : le stock compté correspond au stock système. Aucun
          mouvement créé.
        </div>
      ) : null}

      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="mode" value={mode} />

      <Field label="Type d'opération" htmlFor="m-mode">
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={`dj-btn ${mode === "quantity" ? "dj-btn--primary" : "dj-btn--outline"}`}
            style={{ height: 40, fontSize: 13 }}
            onClick={() => setMode("quantity")}
          >
            Mouvement
          </button>
          <button
            type="button"
            className={`dj-btn ${mode === "inventory" ? "dj-btn--primary" : "dj-btn--outline"}`}
            style={{ height: 40, fontSize: 13 }}
            onClick={() => setMode("inventory")}
          >
            Inventaire (stock compté)
          </button>
        </div>
      </Field>

      <Field label="Produit *" htmlFor="m-product" error={fieldError(state, "productId")}>
        <Select id="m-product" name="productId" required defaultValue={defaultProductId ?? ""}>
          <option value="" disabled>
            Choisir un produit…
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.sku}
            </option>
          ))}
        </Select>
      </Field>

      {mode === "quantity" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Type de mouvement *" htmlFor="m-type" error={fieldError(state, "type")}>
            <Select id="m-type" name="type" required defaultValue="PURCHASE">
              {MANUAL_MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantité *" htmlFor="m-qty" error={fieldError(state, "quantity")}>
            <Input
              id="m-qty"
              name="quantity"
              inputMode="numeric"
              className="tnum"
              required
              placeholder="20"
            />
          </Field>
        </div>
      ) : (
        <Field
          label="Stock compté *"
          htmlFor="m-counted"
          error={fieldError(state, "countedStock")}
          hint="Le serveur calcule l'écart et crée un ajustement +/−."
        >
          <Input
            id="m-counted"
            name="countedStock"
            inputMode="numeric"
            className="tnum"
            required
            placeholder="37"
          />
        </Field>
      )}

      <Field label="Motif" htmlFor="m-reason" error={fieldError(state, "reason")}>
        <Input
          id="m-reason"
          name="reason"
          placeholder={
            mode === "inventory" ? "Inventaire mensuel" : "Réception fournisseur"
          }
        />
      </Field>
      <Field label="Référence (facultatif)" htmlFor="m-ref" error={fieldError(state, "reference")}>
        <Input id="m-ref" name="reference" placeholder="Bon n° 4471" />
      </Field>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <SubmitButton>Enregistrer le mouvement</SubmitButton>
        <a href="/stock" style={{ fontSize: 14, color: "var(--text-3)" }}>
          Annuler
        </a>
      </div>
    </form>
  );
}
