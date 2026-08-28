"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { sendMessageAction } from "@/server/actions/whatsapp.actions";
import { SubmitButton } from "@/components/form";

export function Composer({
  organizationId,
  conversationId,
  windowOpen,
  disabledReason,
}: {
  organizationId: string;
  conversationId: string;
  windowOpen: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(sendMessageAction, null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  if (!windowOpen) {
    return (
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "14px 16px",
          background: "var(--warn-bg)",
          color: "var(--warn-fg)",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {disabledReason ??
          "La fenêtre de 24 h est fermée. Un modèle WhatsApp approuvé est nécessaire pour répondre."}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{
        borderTop: "1px solid var(--border)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: "var(--card)",
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="conversationId" value={conversationId} />
      {state && !state.ok ? (
        <div className="dj-alert dj-alert--error" role="alert" style={{ margin: 0 }}>
          {state.error}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          name="body"
          rows={1}
          required
          maxLength={4096}
          placeholder="Écrire un message…"
          className="dj-input"
          style={{ height: "auto", minHeight: 44, padding: "11px 14px", resize: "vertical", flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <SubmitButton>Envoyer</SubmitButton>
      </div>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Ctrl/⌘ + Entrée pour envoyer · réponse envoyée via WhatsApp Cloud API
      </span>
    </form>
  );
}
