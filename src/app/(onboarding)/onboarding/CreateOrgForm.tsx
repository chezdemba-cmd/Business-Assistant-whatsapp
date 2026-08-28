"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createOrganizationAction } from "@/server/actions/organization.actions";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Card, Field, Input, Select } from "@/components/ui";

const COUNTRIES: Array<[string, string]> = [
  ["ML", "Mali"],
  ["CI", "Côte d'Ivoire"],
  ["SN", "Sénégal"],
  ["BF", "Burkina Faso"],
  ["GH", "Ghana"],
];

const BUSINESS_TYPES: Array<[string, string]> = [
  ["WHOLESALE", "Grossiste / distributeur"],
  ["RETAIL", "Commerce de détail"],
  ["DISTRIBUTION", "Distribution"],
  ["IMPORT_EXPORT", "Import-export"],
  ["OTHER", "Autre"],
];

export function CreateOrgForm() {
  const router = useRouter();
  const [state, action] = useActionState(createOrganizationAction, null);

  useEffect(() => {
    if (state?.ok) router.push(state.data.redirectTo);
  }, [state, router]);

  return (
    <>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 38,
          lineHeight: 1.08,
          margin: "0 0 8px",
        }}
      >
        Créons votre entreprise
      </h1>
      <p style={{ margin: "0 0 32px", color: "var(--text-2)", maxWidth: 480 }}>
        Ces informations définissent votre espace de travail. Vous pourrez inviter
        votre équipe juste après.
      </p>

      <Card>
        <form action={action} className="dj-stack">
          <Feedback state={state} />

          <Field label="Nom de l'entreprise" htmlFor="name" error={fieldError(state, "name")}>
            <Input id="name" name="name" required placeholder="Bamako Distribution" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Pays" htmlFor="countryCode">
              <Select id="countryCode" name="countryCode" defaultValue="ML">
                {COUNTRIES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ville" htmlFor="city" error={fieldError(state, "city")}>
              <Input id="city" name="city" placeholder="Bamako" />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Devise" htmlFor="currency">
              <Select id="currency" name="currency" defaultValue="XOF">
                <option value="XOF">FCFA · XOF</option>
                <option value="XAF">FCFA · XAF</option>
                <option value="GHS">GHS</option>
              </Select>
            </Field>
            <Field label="Type d'activité" htmlFor="businessType">
              <Select id="businessType" name="businessType" defaultValue="WHOLESALE">
                {BUSINESS_TYPES.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <input type="hidden" name="timezone" value="Africa/Bamako" />

          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            Les montants sont enregistrés en unités entières : 31 500 FCFA, jamais
            31 500,00.
          </span>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <SubmitButton>Continuer</SubmitButton>
            <a href="/login" style={{ fontSize: 14, color: "var(--text-3)" }}>
              Retour
            </a>
          </div>
        </form>
      </Card>
    </>
  );
}
