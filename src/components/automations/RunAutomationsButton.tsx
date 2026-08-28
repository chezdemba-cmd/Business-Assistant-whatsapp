"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { runAutomationsAction } from "@/server/actions/automations.actions";

export function RunAutomationsButton() {
  const router = useRouter();
  const [state, action, pending] = useActionState(runAutomationsAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button
        type="submit"
        className="dj-btn dj-btn--outline"
        disabled={pending}
        style={{ height: 34, fontSize: 13, padding: "0 16px" }}
      >
        {pending ? "Analyse en cours…" : "Analyser maintenant"}
      </button>
      {state?.ok ? (
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          {state.data.created} nouvelle(s) · {state.data.updated} mise(s) à jour ·{" "}
          {state.data.expired} résolue(s)
        </span>
      ) : null}
      {state && !state.ok ? (
        <span className="dj-error" style={{ fontSize: 12 }}>{state.error}</span>
      ) : null}
    </form>
  );
}
