"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/server/actions/auth.actions";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, null);

  return (
    <form action={action} className="dj-stack">
      <div>
        <h2 style={{ fontSize: 31, margin: "0 0 6px" }}>Mot de passe oublié</h2>
        <p style={{ margin: 0, color: "var(--text-3)", fontSize: 14 }}>
          Saisissez votre e-mail : si un compte existe, vous recevrez un lien de
          réinitialisation (valable 1 heure).
        </p>
      </div>

      <Feedback
        state={state}
        successMessage="Si un compte correspond à cet e-mail, un lien de réinitialisation vient d'être envoyé. Pensez à vérifier vos spams."
      />

      {!state?.ok ? (
        <>
          <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="vous@entreprise.com"
              required
              invalid={Boolean(fieldError(state, "email"))}
            />
          </Field>
          <SubmitButton>Envoyer le lien</SubmitButton>
        </>
      ) : null}

      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        <a href="/login" style={{ fontWeight: 600 }}>
          Retour à la connexion
        </a>
      </p>
    </form>
  );
}
