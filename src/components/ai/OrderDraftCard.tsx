"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  approveOrderDraftAction,
  rejectOrderDraftAction,
} from "@/server/actions/ai.actions";
import { SubmitButton } from "@/components/form";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  AWAITING_CUSTOMER_CONFIRMATION: "En attente de confirmation client",
  CUSTOMER_CONFIRMED: "Confirmé par le client",
  AWAITING_HUMAN_APPROVAL: "À valider",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
  CONVERTED: "Convertie en commande",
};

export type DraftView = {
  id: string;
  status: string;
  currency: string;
  totalAmount: number;
  convertedOrderId: string | null;
  items: Array<{ productNameSnapshot: string; quantity: number; unitPrice: number; subtotal: number }>;
};

function money(n: number, currency: string): string {
  const label = currency === "XOF" || currency === "XAF" ? "FCFA" : currency;
  return `${String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${label}`;
}

export function OrderDraftCard({
  organizationId,
  draft,
  canApprove,
}: {
  organizationId: string;
  draft: DraftView;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [approveState, approveAction] = useActionState(approveOrderDraftAction, null);
  const [rejectState, rejectAction] = useActionState(rejectOrderDraftAction, null);

  useEffect(() => {
    if (approveState?.ok) router.push(`/orders/${approveState.data.orderId}`);
  }, [approveState, router]);
  useEffect(() => {
    if (rejectState?.ok) router.refresh();
  }, [rejectState, router]);

  const actionable =
    canApprove &&
    (draft.status === "AWAITING_HUMAN_APPROVAL" ||
      draft.status === "CUSTOMER_CONFIRMED" ||
      draft.status === "APPROVED");

  return (
    <div
      style={{
        border: "1px solid var(--accent)",
        borderRadius: 16,
        padding: 14,
        background: "var(--card-alt)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Commande proposée par FEREDRON IA</strong>
        <span className="dj-badge">{STATUS_LABEL[draft.status] ?? draft.status}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        {draft.items.map((it, i) => (
          <div key={i} className="tnum" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              {it.quantity} × {it.productNameSnapshot} @ {money(it.unitPrice, draft.currency)}
            </span>
            <span>{money(it.subtotal, draft.currency)}</span>
          </div>
        ))}
      </div>
      <div
        className="tnum"
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--border)",
          fontWeight: 700,
        }}
      >
        <span>Total</span>
        <span>{money(draft.totalAmount, draft.currency)}</span>
      </div>

      {draft.status === "CONVERTED" && draft.convertedOrderId ? (
        <a
          className="dj-btn dj-btn--outline"
          style={{ marginTop: 10, height: 34, fontSize: 12 }}
          href={`/orders/${draft.convertedOrderId}`}
        >
          Ouvrir la commande
        </a>
      ) : actionable ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <form action={approveAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="draftId" value={draft.id} />
            <SubmitButton>Confirmer la commande</SubmitButton>
          </form>
          <form action={rejectAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="draftId" value={draft.id} />
            <button type="submit" className="dj-btn dj-btn--ghost" style={{ color: "var(--warn-fg)" }}>
              Refuser
            </button>
          </form>
        </div>
      ) : (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-3)" }}>
          {draft.status === "AWAITING_CUSTOMER_CONFIRMATION"
            ? "En attente de la confirmation du client sur WhatsApp."
            : "Aucune action disponible."}
        </p>
      )}

      {approveState && !approveState.ok ? (
        <div className="dj-alert dj-alert--error" style={{ marginTop: 8 }}>
          {approveState.error}
        </div>
      ) : null}
    </div>
  );
}
