"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrderAction } from "@/server/actions/orders.actions";
import { quickCreateCustomerAction } from "@/server/actions/customers.actions";
import {
  OrderLines,
  serializeLines,
  linesSubtotal,
  type OrderLine,
} from "./OrderLines";
import { formatAmount } from "@/lib/format";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Card, Field, Input, Select } from "@/components/ui";

type CustomerOption = { id: string; label: string };

export function NewOrderForm({
  organizationId,
  currency,
  customers,
}: {
  organizationId: string;
  currency: string;
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [list, setList] = useState<CustomerOption[]>(customers);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [delivery, setDelivery] = useState("0");
  const [showQuick, setShowQuick] = useState(false);

  const [state, formAction] = useActionState(createOrderAction, null);
  const [quickState, quickAction] = useActionState(quickCreateCustomerAction, null);

  useEffect(() => {
    if (state?.ok) router.push(`/orders/${state.data.orderId}`);
  }, [state, router]);

  useEffect(() => {
    if (quickState?.ok) {
      const opt = {
        id: quickState.data.id,
        label: quickState.data.phone
          ? `${quickState.data.displayName} · ${quickState.data.phone}`
          : quickState.data.displayName,
      };
      setList((l) => [opt, ...l.filter((x) => x.id !== opt.id)]);
      setCustomerId(quickState.data.id);
      setShowQuick(false);
    }
  }, [quickState]);

  const subtotal = useMemo(() => linesSubtotal(lines), [lines]);
  const discountN = Math.max(0, Math.trunc(Number(discount) || 0));
  const deliveryN = Math.max(0, Math.trunc(Number(delivery) || 0));
  const total = subtotal - Math.min(discountN, subtotal) + deliveryN;
  const hasOverLine = lines.some((l) => l.quantity > l.available);

  return (
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
          <h3 style={{ fontSize: 21, margin: "0 0 14px" }}>Client</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Select
                value={customerId}
                onChange={(e) => setCustomerId(e.currentTarget.value)}
                aria-label="Client"
              >
                <option value="">Choisir un client…</option>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <button
              type="button"
              className="dj-btn dj-btn--outline"
              style={{ height: 46, fontSize: 13 }}
              onClick={() => setShowQuick((v) => !v)}
            >
              {showQuick ? "Fermer" : "Nouveau client rapide"}
            </button>
          </div>

          {showQuick ? (
            <form
              action={quickAction}
              style={{
                marginTop: 14,
                padding: 14,
                background: "var(--card-alt)",
                borderRadius: 16,
                display: "flex",
                gap: 8,
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <input type="hidden" name="organizationId" value={organizationId} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field label="Nom" htmlFor="q-name" error={fieldError(quickState, "displayName")}>
                  <Input id="q-name" name="displayName" required placeholder="Aminata Sanogo" />
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <Field label="Téléphone" htmlFor="q-phone" error={fieldError(quickState, "phone")}>
                  <Input id="q-phone" name="phone" type="tel" placeholder="76 12 34 56" />
                </Field>
              </div>
              <SubmitButton variant="outline">Ajouter</SubmitButton>
              {quickState && !quickState.ok ? (
                <div className="dj-error" style={{ width: "100%" }}>
                  {quickState.error}
                </div>
              ) : null}
            </form>
          ) : null}
        </Card>

        <Card>
          <h3 style={{ fontSize: 21, margin: "0 0 14px" }}>Articles</h3>
          <OrderLines lines={lines} onChange={setLines} currency={currency} />
        </Card>

        <Card>
          <h3 style={{ fontSize: 21, margin: "0 0 14px" }}>Livraison (facultatif)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Adresse" htmlFor="o-addr">
              <Input id="o-addr" name="deliveryAddress" form="new-order" />
            </Field>
            <Field label="Zone" htmlFor="o-area">
              <Input id="o-area" name="deliveryArea" form="new-order" />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="Date souhaitée" htmlFor="o-date">
              <Input id="o-date" name="requestedDeliveryAt" type="date" form="new-order" />
            </Field>
          </div>
        </Card>
      </div>

      <Card style={{ minWidth: 0 }}>
        <h3 style={{ fontSize: 21, margin: "0 0 16px" }}>Récapitulatif</h3>
        <form action={formAction} id="new-order" className="dj-stack">
          <Feedback state={state} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="items" value={serializeLines(lines)} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Remise (FCFA)" htmlFor="o-disc" error={fieldError(state, "discountAmount")}>
              <Input
                id="o-disc"
                name="discountAmount"
                inputMode="numeric"
                className="tnum"
                value={discount}
                onChange={(e) => setDiscount(e.currentTarget.value)}
              />
            </Field>
            <Field label="Livraison (FCFA)" htmlFor="o-deliv" error={fieldError(state, "deliveryFee")}>
              <Input
                id="o-deliv"
                name="deliveryFee"
                inputMode="numeric"
                className="tnum"
                value={delivery}
                onChange={(e) => setDelivery(e.currentTarget.value)}
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="o-notes">
            <textarea
              id="o-notes"
              name="notes"
              className="dj-input"
              rows={2}
              style={{ height: "auto", padding: "12px 18px", resize: "vertical" }}
            />
          </Field>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingTop: 14,
              borderTop: "1px solid var(--border)",
              fontSize: 14,
            }}
          >
            <Row k="Sous-total" v={formatAmount(subtotal, currency)} />
            <Row k="Remise" v={`- ${formatAmount(Math.min(discountN, subtotal), currency)}`} />
            <Row k="Livraison" v={formatAmount(deliveryN, currency)} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingTop: 8,
              }}
            >
              <strong>Total</strong>
              <span
                className="tnum"
                style={{ fontFamily: "var(--font-display)", fontSize: 23 }}
              >
                {formatAmount(total, currency)}
              </span>
            </div>
          </div>

          {hasOverLine ? (
            <div className="dj-alert dj-alert--error">
              Une ligne dépasse le stock disponible. Le serveur refusera la
              commande.
            </div>
          ) : null}

          <SubmitButton>Créer la commande</SubmitButton>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            La commande est créée en statut « Nouvelle ». Le stock est réservé,
            pas décompté.
          </div>
        </form>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--text-2)" }}>{k}</span>
      <span className="tnum">{v}</span>
    </div>
  );
}
