"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  archiveProductAction,
  restoreProductAction,
} from "@/server/actions/catalog.actions";

export function ArchiveToggle({
  organizationId,
  productId,
  archived,
}: {
  organizationId: string;
  productId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const action = archived ? restoreProductAction : archiveProductAction;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !archived &&
          !confirm("Archiver ce produit ? Il restera dans l'historique mais ne sera plus disponible pour de nouvelles opérations.")
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        disabled={pending}
        className="dj-btn dj-btn--outline"
        style={{ height: 40, padding: "0 18px", fontSize: 13 }}
      >
        {pending ? "…" : archived ? "Restaurer" : "Archiver"}
      </button>
      {state && !state.ok ? (
        <div className="dj-error" style={{ marginTop: 6 }}>
          {state.error}
        </div>
      ) : null}
    </form>
  );
}
