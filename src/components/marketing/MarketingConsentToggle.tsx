"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  optInCustomerAction,
  optOutCustomerAction,
} from "@/server/actions/marketing.actions";

export function MarketingConsentToggle({
  customerId,
  optedIn,
  canEdit,
}: {
  customerId: string;
  optedIn: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [outState, optOut] = useActionState(optOutCustomerAction, null);
  const [inState, optIn] = useActionState(optInCustomerAction, null);

  useEffect(() => {
    if (outState?.ok || inState?.ok) router.refresh();
  }, [outState, inState, router]);

  return (
    <div>
      <dt style={{ color: "var(--text-3)", fontWeight: 600, marginBottom: 4 }}>
        Marketing
      </dt>
      <dd style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <span>{optedIn ? "Accepte les campagnes" : "Désinscrit (opt-out)"}</span>
        {canEdit ? (
          optedIn ? (
            <form action={optOut}>
              <input type="hidden" name="customerId" value={customerId} />
              <button type="submit" className="dj-btn dj-btn--ghost" style={{ height: 28, fontSize: 12, padding: "0 10px" }}>
                Désinscrire
              </button>
            </form>
          ) : (
            <form action={optIn}>
              <input type="hidden" name="customerId" value={customerId} />
              <button type="submit" className="dj-btn dj-btn--ghost" style={{ height: 28, fontSize: 12, padding: "0 10px" }}>
                Réinscrire
              </button>
            </form>
          )
        ) : null}
      </dd>
      {(outState && !outState.ok) || (inState && !inState.ok) ? (
        <span className="dj-error" style={{ fontSize: 12 }}>
          {(outState && !outState.ok && outState.error) || (inState && !inState.ok && inState.error)}
        </span>
      ) : null}
    </div>
  );
}
