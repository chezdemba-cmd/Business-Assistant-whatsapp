"use client";

import { useActionState } from "react";
import type { Role } from "@prisma/client";
import { revokeInvitationAction } from "@/server/actions/invitations.actions";
import { roleLabel } from "@/components/ui";

export type InvitationRow = {
  id: string;
  phone: string;
  role: Role;
  createdAt: string;
  invitedBy: string;
};

function RevokeButton({
  organizationId,
  invitationId,
}: {
  organizationId: string;
  invitationId: string;
}) {
  const [state, action, pending] = useActionState(revokeInvitationAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={pending}
        className="dj-btn dj-btn--outline"
        style={{ height: 32, padding: "0 14px", fontSize: 12 }}
      >
        {pending ? "…" : "Révoquer"}
      </button>
      {state && !state.ok ? (
        <span className="dj-error" style={{ marginLeft: 8 }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function InvitationsList({
  organizationId,
  invitations,
}: {
  organizationId: string;
  invitations: InvitationRow[];
}) {
  if (invitations.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        Aucune invitation en attente.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {invitations.map((inv) => (
        <div
          key={inv.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "13px 0",
            borderBottom: "1px solid var(--border-soft)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tnum" style={{ fontWeight: 700 }}>
              {inv.phone}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              {roleLabel(inv.role)} · invité par {inv.invitedBy} · {inv.createdAt}
            </div>
          </div>
          <RevokeButton organizationId={organizationId} invitationId={inv.id} />
        </div>
      ))}
    </div>
  );
}
