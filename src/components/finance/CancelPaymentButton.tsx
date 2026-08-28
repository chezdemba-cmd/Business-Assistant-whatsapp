"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelPaymentAction } from "@/server/actions/payments.actions";

export function CancelPaymentButton({
  organizationId,
  paymentId,
}: {
  organizationId: string;
  paymentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(cancelPaymentAction, null);

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
        className="dj-btn dj-btn--ghost"
        style={{ height: 30, fontSize: 12, color: "var(--warn-fg)" }}
        onClick={() => setOpen(true)}
      >
        Annuler
      </button>
    );
  }

  return (
    <form
      action={formAction}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        border: "1px solid var(--warn-border)",
        background: "var(--warn-bg)",
        borderRadius: 14,
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <p style={{ margin: 0, fontSize: 12, color: "var(--warn-fg)" }}>
        Le paiement passe en « annulé » (jamais supprimé) et le solde est recalculé.
      </p>
      <textarea
        name="reason"
        className="dj-input"
        rows={2}
        placeholder="Motif de l'annulation"
        style={{ height: "auto", padding: "8px 12px", resize: "vertical" }}
      />
      {state && !state.ok ? (
        <div className="dj-alert dj-alert--error" role="alert">
          {state.error}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          className="dj-btn dj-btn--outline"
          style={{ height: 34, fontSize: 12, color: "var(--warn-fg)" }}
        >
          Confirmer l'annulation
        </button>
        <button
          type="button"
          className="dj-btn dj-btn--ghost"
          style={{ height: 34, fontSize: 12 }}
          onClick={() => setOpen(false)}
        >
          Retour
        </button>
      </div>
    </form>
  );
}
