"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitationAction } from "@/server/actions/invitations.actions";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input } from "@/components/ui";

export function AcceptInviteForm({
  token,
  needsAccount,
}: {
  token: string;
  needsAccount: boolean;
}) {
  const router = useRouter();
  const [state, action] = useActionState(acceptInvitationAction, null);

  useEffect(() => {
    if (state?.ok) router.replace(state.data.redirectTo);
  }, [state, router]);

  return (
    <form action={action} className="dj-stack">
      <Feedback state={state} />
      <input type="hidden" name="token" value={token} />

      {needsAccount ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prénom" htmlFor="i-first" error={fieldError(state, "firstName")}>
              <Input id="i-first" name="firstName" required />
            </Field>
            <Field label="Nom" htmlFor="i-last" error={fieldError(state, "lastName")}>
              <Input id="i-last" name="lastName" required />
            </Field>
          </div>
          <Field
            label="Mot de passe"
            htmlFor="i-pass"
            error={fieldError(state, "password")}
          >
            <Input
              id="i-pass"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="8 caractères min."
            />
          </Field>
        </>
      ) : null}

      <SubmitButton>Rejoindre l&apos;entreprise</SubmitButton>
    </form>
  );
}
