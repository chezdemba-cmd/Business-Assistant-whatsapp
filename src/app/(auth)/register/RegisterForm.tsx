"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerAction } from "@/server/actions/auth.actions";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input } from "@/components/ui";

export function RegisterForm() {
  const router = useRouter();
  const [state, action] = useActionState(registerAction, null);

  useEffect(() => {
    if (state?.ok) router.replace(state.data.redirectTo);
  }, [state, router]);

  return (
    <form action={action} className="dj-stack">
      <div>
        <h2 style={{ fontSize: 31, margin: "0 0 6px" }}>Créer mon compte</h2>
        <p style={{ margin: 0, color: "var(--text-3)", fontSize: 14 }}>
          Étape suivante : créer votre entreprise.
        </p>
      </div>

      <Feedback state={state} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Prénom" htmlFor="firstName" error={fieldError(state, "firstName")}>
          <Input id="firstName" name="firstName" required autoComplete="given-name" />
        </Field>
        <Field label="Nom" htmlFor="lastName" error={fieldError(state, "lastName")}>
          <Input id="lastName" name="lastName" required autoComplete="family-name" />
        </Field>
      </div>

      <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>

      <Field
        label="Téléphone WhatsApp (optionnel)"
        htmlFor="phone"
        error={fieldError(state, "phone")}
        hint="Format libre — normalisé automatiquement (+223…)."
      >
        <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="76 12 34 56" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Mot de passe" htmlFor="password" error={fieldError(state, "password")}>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="10 caractères min."
          />
        </Field>
        <Field
          label="Confirmation"
          htmlFor="confirmPassword"
          error={fieldError(state, "confirmPassword")}
        >
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
          />
        </Field>
      </div>

      <SubmitButton>Créer le compte</SubmitButton>

      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        Déjà un compte ?{" "}
        <a href="/login" style={{ fontWeight: 600 }}>
          Se connecter
        </a>
      </p>
    </form>
  );
}
