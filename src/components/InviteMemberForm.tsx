"use client";

import { useActionState } from "react";
import { createInvitationAction } from "@/server/actions/invitations.actions";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input, Select } from "@/components/ui";

const ROLES: Array<[string, string]> = [
  ["EMPLOYEE", "Employé — lecture et tâches assignées"],
  ["SALES", "Commercial — conversations, commandes, ses clients"],
  ["MANAGER", "Gérant — commandes, stock, clients, relances"],
  ["ADMIN", "Administrateur — équipe, paramètres, opérations"],
];

export function InviteMemberForm({
  organizationId,
  countryCode,
  compact = false,
}: {
  organizationId: string;
  countryCode: string;
  compact?: boolean;
}) {
  const [state, action] = useActionState(createInvitationAction, null);

  return (
    <form action={action} className="dj-stack">
      <Feedback state={state} />

      {state?.ok ? (
        <div className="dj-alert dj-alert--ok" style={{ flexDirection: "column" }}>
          <strong>Invitation créée.</strong>
          <span style={{ wordBreak: "break-all" }}>
            Lien à partager (WhatsApp arrive en Phase 2) :{" "}
            <a href={state.data.inviteUrl}>{state.data.inviteUrl}</a>
          </span>
        </div>
      ) : null}

      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="countryCode" value={countryCode} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1.1fr 1fr",
          gap: 14,
        }}
      >
        <Field label="Nom (optionnel)" htmlFor="inv-name" error={fieldError(state, "name")}>
          <Input id="inv-name" name="name" placeholder="Awa Traoré" />
        </Field>
        <Field
          label="Téléphone WhatsApp"
          htmlFor="inv-phone"
          error={fieldError(state, "phone")}
          hint={`Numéro local (${countryCode}) ou format international (+225…).`}
        >
          <Input id="inv-phone" name="phone" type="tel" required placeholder="65 88 20 14" />
        </Field>
      </div>

      <Field label="Rôle" htmlFor="inv-role" error={fieldError(state, "role")}>
        <Select id="inv-role" name="role" defaultValue="EMPLOYEE">
          {ROLES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <SubmitButton>Envoyer l&apos;invitation</SubmitButton>
      </div>
    </form>
  );
}
