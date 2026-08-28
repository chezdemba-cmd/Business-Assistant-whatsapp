"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  adminSetPlanAction,
  adminSetSubscriptionStatusAction,
  adminTogglePilotAction,
  adminRevokeUserSessionsAction,
} from "@/server/actions/admin.actions";

export function AdminOrgControls({
  organizationId,
  planCode,
  subStatus,
  isPilot,
}: {
  organizationId: string;
  planCode: string;
  subStatus: string;
  isPilot: boolean;
}) {
  const router = useRouter();
  const [planState, setPlan] = useActionState(adminSetPlanAction, null);
  const [statusState, setStatus] = useActionState(adminSetSubscriptionStatusAction, null);
  const [pilotState, togglePilot] = useActionState(adminTogglePilotAction, null);
  const [revokeState, revoke] = useActionState(adminRevokeUserSessionsAction, null);

  useEffect(() => {
    if (planState?.ok || statusState?.ok || pilotState?.ok) router.refresh();
  }, [planState, statusState, pilotState, router]);

  const box: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
      <div style={box}>
        <strong style={{ fontSize: 14 }}>Offre</strong>
        <form action={setPlan} style={{ display: "flex", gap: 8 }}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <select name="planCode" defaultValue={planCode} className="dj-input">
            <option value="STARTER">STARTER</option>
            <option value="BUSINESS">BUSINESS</option>
            <option value="PRO">PRO</option>
          </select>
          <button type="submit" className="dj-btn dj-btn--outline">Appliquer</button>
        </form>
      </div>

      <div style={box}>
        <strong style={{ fontSize: 14 }}>Abonnement</strong>
        <form action={setStatus} style={{ display: "flex", gap: 8 }}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <select name="status" defaultValue={subStatus} className="dj-input">
            {["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "SUSPENDED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="submit" className="dj-btn dj-btn--outline">Appliquer</button>
        </form>
      </div>

      <div style={box}>
        <strong style={{ fontSize: 14 }}>Programme pilote</strong>
        <form action={togglePilot}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="isPilot" value={isPilot ? "0" : "1"} />
          <button type="submit" className="dj-btn dj-btn--outline">
            {isPilot ? "Retirer du pilote" : "Marquer comme pilote"}
          </button>
        </form>
      </div>

      <div style={box}>
        <strong style={{ fontSize: 14 }}>Sessions utilisateur</strong>
        <form action={revoke} style={{ display: "flex", gap: 8 }}>
          <input name="email" type="email" placeholder="email de l'utilisateur" className="dj-input" required />
          <button type="submit" className="dj-btn dj-btn--ghost">Révoquer</button>
        </form>
        {revokeState?.ok ? <span style={{ fontSize: 12, color: "var(--ok-fg)" }}>Sessions révoquées.</span> : null}
        {revokeState && !revokeState.ok ? <span className="dj-error" style={{ fontSize: 12 }}>{revokeState.error}</span> : null}
      </div>
    </div>
  );
}
