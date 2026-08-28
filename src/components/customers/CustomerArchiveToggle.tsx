"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  archiveCustomerAction,
  restoreCustomerAction,
} from "@/server/actions/customers.actions";

export function CustomerArchiveToggle({
  organizationId,
  customerId,
  archived,
}: {
  organizationId: string;
  customerId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const action = archived ? restoreCustomerAction : archiveCustomerAction;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!archived && !confirm("Archiver ce client ? Ses commandes restent visibles."))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="customerId" value={customerId} />
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
