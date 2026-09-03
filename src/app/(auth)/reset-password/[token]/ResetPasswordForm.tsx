"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "@/server/actions/auth.actions";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input } from "@/components/ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, action] = useActionState(resetPasswordAction, null);

  useEffect(() => {
    if (state?.ok) router.replace(state.data.redirectTo);
  }, [state, router]);

  return (
    <form action={action} className="dj-stack">
      <div>
        <h2 style={{ fontSize: 31, margin: "0 0 6px" }}>Nouveau mot de passe</h2>
        <p style={{ margin: 0, color: "var(--text-3)", fontSize: 14 }}>
          Choisissez un mot de passe. Toutes vos sessions ouvertes seront déconnectées.
        </p>
      </div>

      <Feedback state={state} />

      <input type="hidden" name="token" value={token} />

      <Field
        label="Nouveau mot de passe"
        htmlFor="newPassword"
        error={fieldError(state, "newPassword")}
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="8 caractères min."
          required
          invalid={Boolean(fieldError(state, "newPassword"))}
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
          autoComplete="new-password"
          required
          invalid={Boolean(fieldError(state, "confirmPassword"))}
        />
      </Field>

      <SubmitButton>Réinitialiser</SubmitButton>

      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        <a href="/forgot-password" style={{ fontWeight: 600 }}>
          Demander un nouveau lien
        </a>
      </p>
    </form>
  );
}
