"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateDueDateAction } from "@/server/actions/payments.actions";
import { SubmitButton } from "@/components/form";

function toInputDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function DueDateForm({
  organizationId,
  orderId,
  dueDate,
}: {
  organizationId: string;
  orderId: string;
  dueDate: Date | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateDueDateAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={formAction}
      style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="orderId" value={orderId} />
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        <span style={{ color: "var(--text-3)", fontWeight: 600 }}>Échéance</span>
        <input
          type="date"
          name="dueDate"
          defaultValue={toInputDate(dueDate)}
          className="dj-input"
          style={{ height: 38 }}
        />
      </label>
      <SubmitButton variant="outline">Enregistrer</SubmitButton>
      {state && !state.ok ? (
        <span className="dj-error">{state.error}</span>
      ) : null}
    </form>
  );
}
