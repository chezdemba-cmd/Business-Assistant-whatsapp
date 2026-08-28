"use client";

import { useActionState } from "react";
import type { Role } from "@prisma/client";
import {
  updateMemberRoleAction,
  removeMemberAction,
} from "@/server/actions/members.actions";
import { RoleBadge, roleLabel } from "@/components/ui";

export type MemberRowData = {
  membershipId: string;
  name: string;
  phone: string | null;
  email: string;
  role: Role;
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  isOwner: boolean;
  isSelf: boolean;
};

const ASSIGNABLE: Role[] = ["ADMIN", "MANAGER", "SALES", "EMPLOYEE"];

function RoleControl({
  organizationId,
  row,
}: {
  organizationId: string;
  row: MemberRowData;
}) {
  const [state, action, pending] = useActionState(updateMemberRoleAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="membershipId" value={row.membershipId} />
      <select
        name="role"
        defaultValue={row.role}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="dj-input"
        style={{ height: 36, padding: "0 12px", fontSize: 13, width: "auto" }}
      >
        {ASSIGNABLE.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      {state && !state.ok ? (
        <div className="dj-error" style={{ marginTop: 4 }}>
          {state.error}
        </div>
      ) : null}
    </form>
  );
}

function RemoveControl({
  organizationId,
  row,
}: {
  organizationId: string;
  row: MemberRowData;
}) {
  const [state, action, pending] = useActionState(removeMemberAction, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Retirer ${row.name} de l'entreprise ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="membershipId" value={row.membershipId} />
      <button
        type="submit"
        disabled={pending}
        className="dj-btn dj-btn--outline"
        style={{ height: 34, padding: "0 14px", fontSize: 12, color: "var(--warn-fg)" }}
      >
        {pending ? "…" : "Retirer"}
      </button>
      {state && !state.ok ? (
        <div className="dj-error" style={{ marginTop: 4 }}>
          {state.error}
        </div>
      ) : null}
    </form>
  );
}

export function MembersTable({
  organizationId,
  members,
  canUpdate,
  canRemove,
}: {
  organizationId: string;
  members: MemberRowData[];
  canUpdate: boolean;
  canRemove: boolean;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "var(--panel)" }}>
            <Th>Membre</Th>
            <Th>Téléphone</Th>
            <Th>Rôle</Th>
            <Th>Statut</Th>
            {canRemove ? <Th> </Th> : null}
          </tr>
        </thead>
        <tbody>
          {members.map((row) => {
            const editable = canUpdate && !row.isOwner && !row.isSelf;
            return (
              <tr
                key={row.membershipId}
                style={{ borderTop: "1px solid var(--border-soft)" }}
              >
                <Td>
                  <div style={{ fontWeight: 700 }}>{row.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {row.email}
                  </div>
                </Td>
                <Td className="tnum" style={{ color: "var(--text-2)" }}>
                  {row.phone ?? "—"}
                </Td>
                <Td>
                  {editable ? (
                    <RoleControl organizationId={organizationId} row={row} />
                  ) : (
                    <RoleBadge role={row.role} />
                  )}
                </Td>
                <Td style={{ color: "var(--text-2)", fontSize: 13 }}>
                  {row.status === "ACTIVE"
                    ? "Actif"
                    : row.status === "INVITED"
                      ? "Invité"
                      : "Suspendu"}
                </Td>
                {canRemove ? (
                  <Td style={{ textAlign: "right" }}>
                    {!row.isOwner && !row.isSelf ? (
                      <RemoveControl organizationId={organizationId} row={row} />
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </Td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "14px 16px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "var(--text-2)",
        textTransform: "uppercase",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <td className={className} style={{ padding: "15px 16px", ...style }}>
      {children}
    </td>
  );
}
