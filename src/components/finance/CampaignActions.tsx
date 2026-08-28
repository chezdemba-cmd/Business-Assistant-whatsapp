"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  sendReminderCampaignAction,
  cancelReminderCampaignAction,
} from "@/server/actions/reminders.actions";
import { SubmitButton } from "@/components/form";

export function SendCampaignButton({
  organizationId,
  campaignId,
  itemCount,
}: {
  organizationId: string;
  campaignId: string;
  itemCount: number;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(sendReminderCampaignAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !confirm(
            `Marquer ${itemCount} relance(s) comme envoyées ? Mode simulation — aucun message WhatsApp ne part réellement.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="campaignId" value={campaignId} />
      <SubmitButton>Envoyer (simulation)</SubmitButton>
      {state && !state.ok ? (
        <span className="dj-error" style={{ marginLeft: 8 }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function CancelCampaignButton({
  organizationId,
  campaignId,
}: {
  organizationId: string;
  campaignId: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(cancelReminderCampaignAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Annuler cette campagne de relance ?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="campaignId" value={campaignId} />
      <button
        type="submit"
        className="dj-btn dj-btn--ghost"
        style={{ color: "var(--warn-fg)" }}
      >
        Annuler la campagne
      </button>
      {state && !state.ok ? (
        <span className="dj-error" style={{ marginLeft: 8 }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
