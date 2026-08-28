"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { transitionOrderAction } from "@/server/actions/orders.actions";
import { ORDER_STATUS_LABEL, nextStatuses } from "@/server/orders/order-status";
import { SubmitButton } from "@/components/form";

const SOFT_END: OrderStatus[] = ["CANCELLED", "REJECTED"];

export function OrderStatusActions({
  organizationId,
  orderId,
  status,
}: {
  organizationId: string;
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(transitionOrderAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const targets = nextStatuses(status);
  const advance = targets.filter((t) => !SOFT_END.includes(t));
  const endings = targets.filter((t) => SOFT_END.includes(t));

  if (targets.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        Aucune action disponible pour ce statut.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {state && !state.ok ? (
        <div className="dj-alert dj-alert--error" role="alert">
          {state.error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {advance.map((to) => (
          <form key={to} action={formAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="to" value={to} />
            <SubmitButton>{`Passer en « ${ORDER_STATUS_LABEL[to]} »`}</SubmitButton>
          </form>
        ))}
      </div>

      {endings.length > 0 ? (
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontSize: 13,
              color: "var(--accent-active)",
              fontWeight: 600,
            }}
          >
            Annuler / refuser la commande
          </summary>
          <div
            style={{
              marginTop: 10,
              padding: 14,
              border: "1px solid var(--warn-border)",
              background: "var(--warn-bg)",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {endings.map((to) => (
              <form
                key={to}
                action={formAction}
                onSubmit={(e) => {
                  if (
                    !confirm(
                      `${ORDER_STATUS_LABEL[to]} : les réservations de stock seront libérées. Confirmer ?`,
                    )
                  )
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="organizationId" value={organizationId} />
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="to" value={to} />
                <textarea
                  name="reason"
                  className="dj-input"
                  rows={2}
                  placeholder={`Motif de ${ORDER_STATUS_LABEL[to].toLowerCase()}`}
                  style={{ height: "auto", padding: "10px 14px", resize: "vertical", marginBottom: 8 }}
                />
                <button
                  type="submit"
                  className="dj-btn dj-btn--outline"
                  style={{ height: 38, fontSize: 13, color: "var(--warn-fg)" }}
                >
                  {ORDER_STATUS_LABEL[to]}
                </button>
              </form>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
