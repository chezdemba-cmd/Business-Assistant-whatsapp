"use client";

import { useActionState } from "react";
import {
  updateProfileAction,
  changePasswordAction,
  revokeAllSessionsAction,
} from "@/server/actions/profile.actions";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input, Select } from "@/components/ui";

export function ProfileForm({
  firstName,
  lastName,
  email,
  phone,
  locale,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  locale: string;
}) {
  const [state, action] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className="dj-stack">
      <Feedback state={state} successMessage="Profil enregistré." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Prénom" htmlFor="p-first" error={fieldError(state, "firstName")}>
          <Input id="p-first" name="firstName" defaultValue={firstName} required />
        </Field>
        <Field label="Nom" htmlFor="p-last" error={fieldError(state, "lastName")}>
          <Input id="p-last" name="lastName" defaultValue={lastName} required />
        </Field>
      </div>
      <Field label="Langue" htmlFor="p-locale">
        <Select id="p-locale" name="locale" defaultValue={locale}>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </Select>
      </Field>
      <Field label="Email (identifiant de connexion)" htmlFor="p-email">
        <Input id="p-email" className="dj-input--readonly" value={email} readOnly disabled />
      </Field>
      <Field
        label="Téléphone WhatsApp"
        htmlFor="p-phone"
        hint="Contactez le support pour modifier le numéro."
      >
        <Input
          id="p-phone"
          className="dj-input--readonly"
          value={phone || "—"}
          readOnly
          disabled
        />
      </Field>
      <div>
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="dj-stack">
      <Feedback state={state} successMessage="Mot de passe modifié." />
      <Field
        label="Mot de passe actuel"
        htmlFor="cp-current"
        error={fieldError(state, "currentPassword")}
      >
        <Input
          id="cp-current"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Nouveau" htmlFor="cp-new" error={fieldError(state, "newPassword")}>
          <Input
            id="cp-new"
            name="newPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="10 caractères min."
          />
        </Field>
        <Field
          label="Confirmation"
          htmlFor="cp-confirm"
          error={fieldError(state, "confirmPassword")}
        >
          <Input
            id="cp-confirm"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
          />
        </Field>
      </div>
      <div>
        <SubmitButton>Changer le mot de passe</SubmitButton>
      </div>
    </form>
  );
}

export function RevokeSessionsForm() {
  const [state, action] = useActionState(revokeAllSessionsAction, null);
  return (
    <form action={action} className="dj-stack">
      <Feedback state={state} successMessage="Tous les autres appareils ont été déconnectés." />
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
        Déconnecte votre compte de tous les appareils (utile en cas de perte ou
        de vol). Vous restez connecté ici.
      </p>
      <div>
        <SubmitButton variant="outline">Déconnecter tous les appareils</SubmitButton>
      </div>
    </form>
  );
}
