"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recordPaymentAction } from "@/server/actions/payments.actions";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  PAYMENT_PROVIDER_LABEL,
  PAYMENT_PROVIDERS,
} from "@/server/finance/payment-rules";
import { formatAmount } from "@/lib/format";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton, Feedback, fieldError } from "@/components/form";

type OrderOption = { id: string; reference: string; balanceDue: number };

export function RecordPaymentForm({
  organizationId,
  customerId,
  currency,
  orderId,
  balanceDue,
  orderOptions,
  compact,
}: {
  organizationId: string;
  customerId: string;
  currency: string;
  /** Paiement rattaché à une commande précise (fiche commande). */
  orderId?: string;
  /** Solde restant de cette commande, pour l'indication « reste à payer ». */
  balanceDue?: number;
  /** Choix de commande (fiche client) — commandes avec solde ouvert. */
  orderOptions?: OrderOption[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(recordPaymentAction, null);
  const [method, setMethod] = useState("CASH");

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        className={`dj-btn ${compact ? "dj-btn--outline" : "dj-btn--primary"}`}
        style={compact ? { height: 36, fontSize: 13 } : undefined}
        onClick={() => setOpen(true)}
      >
        Enregistrer un paiement
      </button>
    );
  }

  return (
    <form
      action={formAction}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: 20,
        background: "var(--card-alt)",
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="customerId" value={customerId} />
      {orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}

      <div style={{ fontSize: 14, fontWeight: 700 }}>Nouveau paiement</div>

      {orderOptions ? (
        <Field label="Commande" htmlFor="pay-order" error={fieldError(state, "orderId")}>
          <Select id="pay-order" name="orderId" defaultValue="">
            <option value="">Aucune (encaissement libre)</option>
            {orderOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.reference} — reste {formatAmount(o.balanceDue, currency)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {typeof balanceDue === "number" ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)" }}>
          Reste à payer : <strong>{formatAmount(balanceDue, currency)}</strong>
        </p>
      ) : null}

      <Field label="Montant" htmlFor="pay-amount" error={fieldError(state, "amount")}>
        <Input
          id="pay-amount"
          name="amount"
          inputMode="numeric"
          placeholder="Ex : 50 000"
          required
          invalid={Boolean(fieldError(state, "amount"))}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Moyen" htmlFor="pay-method" error={fieldError(state, "method")}>
          <Select
            id="pay-method"
            name="method"
            value={method}
            onChange={(e) => setMethod(e.currentTarget.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="pay-date" error={fieldError(state, "paidAt")}>
          <Input id="pay-date" name="paidAt" type="date" />
        </Field>
      </div>

      {method === "MOBILE_MONEY" ? (
        <Field label="Opérateur" htmlFor="pay-provider">
          <Select id="pay-provider" name="provider" defaultValue="">
            <option value="">Non précisé</option>
            {PAYMENT_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PAYMENT_PROVIDER_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Référence (facultatif)" htmlFor="pay-ref">
        <Input id="pay-ref" name="reference" placeholder="N° de transaction, chèque…" />
      </Field>
      <Field label="Note (facultatif)" htmlFor="pay-notes">
        <Input id="pay-notes" name="notes" />
      </Field>

      <Feedback state={state} />

      <div style={{ display: "flex", gap: 10 }}>
        <SubmitButton>Enregistrer</SubmitButton>
        <button
          type="button"
          className="dj-btn dj-btn--ghost"
          onClick={() => setOpen(false)}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
