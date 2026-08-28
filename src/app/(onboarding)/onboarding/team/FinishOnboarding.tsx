"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { completeOnboardingAction } from "@/server/actions/organization.actions";
import { SubmitButton } from "@/components/form";

export function FinishOnboarding() {
  const router = useRouter();
  const [state, action] = useActionState(completeOnboardingAction, null);

  useEffect(() => {
    if (state?.ok) router.push(state.data.redirectTo);
  }, [state, router]);

  return (
    <form action={action} style={{ display: "flex", gap: 12 }}>
      <SubmitButton>Terminer et aller au tableau de bord</SubmitButton>
    </form>
  );
}
