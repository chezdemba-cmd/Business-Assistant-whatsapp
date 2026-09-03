"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/server/actions/auth.actions";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, null);

  if (state?.ok) {
    return (
      <div className="dj-stack">
        <h2 style={{ fontSize: 31, margin: "0 0 6px" }}>Vérifiez votre boîte mail</h2>
        <p style={{ margin: 0, color: "var(--text-3)", fontSize: 14 }}>
          Si un compte existe pour cet e-mail, un lien de réinitialisation vient d&apos;être
          envoyé. Il est valable une heure.
        </p>
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
          <a href="/login" style={{ fontWeight: 600 }}>
            Retour à la connexion
          </a>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="dj-stack">
      <div>
        <h2 style={{ fontSize: 31, margin: "0 0 6px" }}>Mot de passe oublié</h2>
        <p style={{ margin: 0, color: "var(--text-3)", fontSize: 14 }}>
          Entrez votre e-mail : nous vous enverrons un lien pour choisir un nouveau
          mot de passe.
        </p>
      </div>

      <Feedback state={state} />

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

      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        <a href="/login" style={{ fontWeight: 600 }}>
          Retour à la connexion
        </a>
      </p>
    </form>
  );
}
