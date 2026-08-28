"use client";

import { useActionState } from "react";
import { updateOrganizationSettingsAction } from "@/server/actions/settings.actions";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input, Select, Alert } from "@/components/ui";

export type OrgSettings = {
  id: string;
  name: string;
  phone: string;
  email: string;
  countryCode: string;
  currency: string;
  timezone: string;
  addressLine: string;
  city: string;
  district: string;
  businessType: string;
};

const BUSINESS_TYPES: Array<[string, string]> = [
  ["WHOLESALE", "Grossiste / distributeur"],
  ["RETAIL", "Commerce de détail"],
  ["DISTRIBUTION", "Distribution"],
  ["IMPORT_EXPORT", "Import-export"],
  ["OTHER", "Autre"],
];

export function SettingsForm({
  org,
  canEdit,
}: {
  org: OrgSettings;
  canEdit: boolean;
}) {
  const [state, action] = useActionState(updateOrganizationSettingsAction, null);
  const ro = !canEdit;

  return (
    <form action={action} className="dj-stack">
      {ro ? (
        <Alert kind="info">
          Lecture seule — votre rôle ne permet pas de modifier les paramètres de
          l&apos;entreprise.
        </Alert>
      ) : null}
      <Feedback state={state} successMessage="Paramètres enregistrés." />

      <input type="hidden" name="organizationId" value={org.id} />

      <Field label="Nom de l'entreprise" htmlFor="s-name" error={fieldError(state, "name")}>
        <Input id="s-name" name="name" defaultValue={org.name} required disabled={ro} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Téléphone" htmlFor="s-phone" error={fieldError(state, "phone")}>
          <Input id="s-phone" name="phone" defaultValue={org.phone} disabled={ro} />
        </Field>
        <Field label="Email" htmlFor="s-email" error={fieldError(state, "email")}>
          <Input id="s-email" name="email" type="email" defaultValue={org.email} disabled={ro} />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Field label="Pays (ISO-2)" htmlFor="s-country" error={fieldError(state, "countryCode")}>
          <Input
            id="s-country"
            name="countryCode"
            defaultValue={org.countryCode}
            maxLength={2}
            required
            disabled={ro}
          />
        </Field>
        <Field label="Devise" htmlFor="s-currency" error={fieldError(state, "currency")}>
          <Input
            id="s-currency"
            name="currency"
            defaultValue={org.currency}
            maxLength={3}
            required
            disabled={ro}
          />
        </Field>
        <Field label="Fuseau horaire" htmlFor="s-tz" error={fieldError(state, "timezone")}>
          <Input id="s-tz" name="timezone" defaultValue={org.timezone} required disabled={ro} />
        </Field>
      </div>

      <Field label="Adresse" htmlFor="s-addr" error={fieldError(state, "addressLine")}>
        <Input id="s-addr" name="addressLine" defaultValue={org.addressLine} disabled={ro} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Ville" htmlFor="s-city" error={fieldError(state, "city")}>
          <Input id="s-city" name="city" defaultValue={org.city} disabled={ro} />
        </Field>
        <Field label="Quartier" htmlFor="s-district" error={fieldError(state, "district")}>
          <Input id="s-district" name="district" defaultValue={org.district} disabled={ro} />
        </Field>
      </div>

      <Field label="Type d'activité" htmlFor="s-type">
        <Select
          id="s-type"
          name="businessType"
          defaultValue={org.businessType}
          disabled={ro}
        >
          {BUSINESS_TYPES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <span style={{ fontSize: 12, color: "var(--text-3)" }}>
        Les montants sont enregistrés en unités entières (ex. 31 500 FCFA).
      </span>

      {!ro ? (
        <div>
          <SubmitButton>Enregistrer</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
