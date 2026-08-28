"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderItemsAction } from "@/server/actions/orders.actions";
import {
  OrderLines,
  serializeLines,
  linesSubtotal,
  type OrderLine,
} from "./OrderLines";
import { formatAmount } from "@/lib/format";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Card, Field, Input } from "@/components/ui";

export function EditOrderLinesForm({
  organizationId,
  orderId,
  currency,
  initialLines,
  initialDiscount,
  initialDelivery,
  initialNotes,
}: {
  organizationId: string;
  orderId: string;
  currency: string;
  initialLines: OrderLine[];
  initialDiscount: number;
  initialDelivery: number;
  initialNotes: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<OrderLine[]>(initialLines);
  const [discount, setDiscount] = useState(String(initialDiscount));
  const [delivery, setDelivery] = useState(String(initialDelivery));
  const [state, formAction] = useActionState(updateOrderItemsAction, null);

  useEffect(() => {
    if (state?.ok) router.push(`/orders/${orderId}`);
  }, [state, router, orderId]);

  const subtotal = useMemo(() => linesSubtotal(lines), [lines]);
  const discountN = Math.max(0, Math.trunc(Number(discount) || 0));
  const deliveryN = Math.max(0, Math.trunc(Number(delivery) || 0));
  const total = subtotal - Math.min(discountN, subtotal) + deliveryN;

  return (
    <Card>
      <form action={formAction} className="dj-stack">
        <Feedback state={state} />
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="items" value={serializeLines(lines)} />

        <OrderLines lines={lines} onChange={setLines} currency={currency} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Remise (FCFA)" htmlFor="e-disc" error={fieldError(state, "discountAmount")}>
            <Input
              id="e-disc"
              name="discountAmount"
              inputMode="numeric"
              className="tnum"
              value={discount}
              onChange={(e) => setDiscount(e.currentTarget.value)}
            />
          </Field>
          <Field label="Livraison (FCFA)" htmlFor="e-deliv" error={fieldError(state, "deliveryFee")}>
            <Input
              id="e-deliv"
              name="deliveryFee"
              inputMode="numeric"
              className="tnum"
              value={delivery}
              onChange={(e) => setDelivery(e.currentTarget.value)}
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="e-notes">
          <textarea
            id="e-notes"
            name="notes"
            className="dj-input"
            rows={2}
            style={{ height: "auto", padding: "12px 18px", resize: "vertical" }}
            defaultValue={initialNotes}
          />
        </Field>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
          }}
        >
          <strong>Nouveau total</strong>
          <span className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 21 }}>
            {formatAmount(total, currency)}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <SubmitButton>Enregistrer les articles</SubmitButton>
          <a href={`/orders/${orderId}`} style={{ fontSize: 14, color: "var(--text-3)" }}>
            Annuler
          </a>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          Les réservations de stock sont recalculées (libérées puis reprises)
          dans une transaction.
        </div>
      </form>
    </Card>
  );
}
