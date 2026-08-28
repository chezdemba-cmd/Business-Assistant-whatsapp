"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createReminderCampaignAction } from "@/server/actions/reminders.actions";
import { SubmitButton } from "@/components/form";

/**
 * Relance individuelle depuis une fiche commande ou une fiche client.
 * Crée une campagne d'un seul élément puis ouvre son écran de préparation.
 * Aucun envoi réel — l'écran suivant l'indique.
 */
export function PrepareReminderButton({
  organizationId,
  orderId,
  customerId,
  label = "Préparer une relance",
  compact,
}: {
  organizationId: string;
  orderId?: string;
  customerId?: string;
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(createReminderCampaignAction, null);

  useEffect(() => {
    if (state?.ok) router.push(`/reminders/${state.data.campaignId}`);
  }, [state, router]);

  return (
    <form action={formAction} style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <input type="hidden" name="organizationId" value={organizationId} />
      {orderId ? (
        <input type="hidden" name="orderIds" value={JSON.stringify([orderId])} />
      ) : null}
      {customerId ? (
        <input type="hidden" name="customerIds" value={JSON.stringify([customerId])} />
      ) : null}
      <SubmitButton
        variant="outline"
        style={compact ? { height: 36, fontSize: 13 } : undefined}
      >
        {label}
      </SubmitButton>
      {state && !state.ok ? <span className="dj-error">{state.error}</span> : null}
    </form>
  );
}
