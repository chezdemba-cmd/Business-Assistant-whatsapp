"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ConversationMode } from "@prisma/client";
import {
  setConversationModeAction,
  assignConversationAction,
} from "@/server/actions/whatsapp.actions";
import { CONVERSATION_MODE_LABEL } from "@/server/whatsapp/conversation-mode";

const MODE_BUTTONS: Array<{ mode: ConversationMode; label: string }> = [
  { mode: "HUMAN", label: "Prendre la main" },
  { mode: "AUTO", label: "Activer AUTO" },
  { mode: "PAUSED", label: "Mettre en pause" },
];

export function ConversationModeControls({
  organizationId,
  conversationId,
  mode,
}: {
  organizationId: string;
  conversationId: string;
  mode: ConversationMode;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(setConversationModeAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {MODE_BUTTONS.map((b) => (
          <form key={b.mode} action={formAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="conversationId" value={conversationId} />
            <input type="hidden" name="mode" value={b.mode} />
            <button
              type="submit"
              className={`dj-btn ${mode === b.mode ? "dj-btn--primary" : "dj-btn--outline"}`}
              style={{ height: 32, fontSize: 12 }}
              disabled={mode === b.mode}
            >
              {b.label}
            </button>
          </form>
        ))}
      </div>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Mode actuel : <strong>{CONVERSATION_MODE_LABEL[mode]}</strong>. En AUTO,
        FEREDRON IA ne répond pas encore (Phase 6).
      </span>
      {state && !state.ok ? <span className="dj-error">{state.error}</span> : null}
    </div>
  );
}

export function AssignControl({
  organizationId,
  conversationId,
  assignedToUserId,
  members,
}: {
  organizationId: string;
  conversationId: string;
  assignedToUserId: string | null;
  members: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(assignConversationAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="conversationId" value={conversationId} />
      <select
        name="assigneeUserId"
        defaultValue={assignedToUserId ?? ""}
        className="dj-input"
        style={{ height: 34, fontSize: 12 }}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Non assignée</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {state && !state.ok ? <span className="dj-error">{state.error}</span> : null}
    </form>
  );
}
