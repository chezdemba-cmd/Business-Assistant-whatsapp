"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/server/actions/auth.actions";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [state, action] = useActionState(loginAction, null);

  useEffect(() => {
    if (state?.ok) {
      router.replace(next && next.startsWith("/") ? next : state.data.redirectTo);
    }
  }, [state, router, next]);

  return (
    <form action={action} className="dj-stack">
      <div>
        <h2 style={{ fontSize: 31, margin: "0 0 6px" }}>Se connecter</h2>
        <p style={{ margin: 0, color: "var(--text-3)", fontSize: 14 }}>
          Accédez à l&apos;espace de votre entreprise.
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

      <Field
        label="Mot de passe"
        htmlFor="password"
        error={fieldError(state, "password")}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(fieldError(state, "password"))}
        />
      </Field>

      <SubmitButton>Continuer</SubmitButton>

      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        Pas encore de compte ?{" "}
        <a href="/register" style={{ fontWeight: 600 }}>
          Créer mon entreprise
        </a>
      </p>
    </form>
  );
}
