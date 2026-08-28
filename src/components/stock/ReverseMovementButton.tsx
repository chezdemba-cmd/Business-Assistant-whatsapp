"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { reverseStockMovementAction } from "@/server/actions/stock.actions";

export function ReverseMovementButton({
  organizationId,
  movementId,
  label,
}: {
  organizationId: string;
  movementId: string;
  label: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    reverseStockMovementAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Annuler le mouvement « ${label} » ? Un mouvement compensatoire sera créé (l'original reste dans l'historique).`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="movementId" value={movementId} />
      <button
        type="submit"
        disabled={pending}
        className="dj-btn dj-btn--outline"
        style={{ height: 30, padding: "0 12px", fontSize: 12 }}
      >
        {pending ? "…" : "Annuler"}
      </button>
      {state && !state.ok ? (
        <span className="dj-error" style={{ marginLeft: 8 }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
