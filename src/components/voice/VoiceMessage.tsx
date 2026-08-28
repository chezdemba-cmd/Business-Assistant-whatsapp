"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  correctTranscriptionAction,
  retranscribeTranscriptionAction,
} from "@/server/actions/voice.actions";
import { SubmitButton } from "@/components/form";

const LANG_LABEL: Record<string, string> = {
  FR: "Français",
  BM: "Bambara",
  MIXED: "Mixte FR/BM",
  UNKNOWN: "Langue indéterminée",
};

export type VoiceTranscriptionView = {
  status: string;
  effectiveText: string;
  originalText: string;
  correctedText: string | null;
  detectedLanguage: string;
  confidence: number | null;
  errorCode: string | null;
};

export function VoiceMessage({
  organizationId,
  messageId,
  transcription,
  canEdit,
  outbound,
}: {
  organizationId: string;
  messageId: string;
  transcription: VoiceTranscriptionView | null;
  canEdit: boolean;
  outbound: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [correctState, correctAction] = useActionState(correctTranscriptionAction, null);
  const [retryState, retryAction] = useActionState(retranscribeTranscriptionAction, null);

  useEffect(() => {
    if (correctState?.ok || retryState?.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [correctState, retryState, router]);

  const muted = outbound ? "rgba(255,255,255,0.8)" : "var(--text-3)";

  return (
    <div style={{ fontSize: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 3 }}>🎙️ Message vocal</div>

      {!transcription || transcription.status === "PENDING" || transcription.status === "PROCESSING" ? (
        <div style={{ fontSize: 13, color: muted }}>Transcription en cours…</div>
      ) : transcription.status === "FAILED" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, color: muted }}>
            Impossible de transcrire ce vocal{transcription.errorCode ? ` (${transcription.errorCode})` : ""}.
          </span>
          {canEdit ? (
            <form action={retryAction}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="messageId" value={messageId} />
              <button type="submit" className="dj-btn dj-btn--outline" style={{ height: 30, fontSize: 12 }}>
                Réessayer
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: muted }}>
            Transcription :
          </div>
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            « {transcription.effectiveText} »
          </div>
          <div style={{ fontSize: 11, color: muted, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{LANG_LABEL[transcription.detectedLanguage] ?? transcription.detectedLanguage}</span>
            {transcription.confidence != null ? (
              <span>· confiance {(transcription.confidence * 100).toFixed(0)}%</span>
            ) : null}
            {transcription.status === "CORRECTED" ? <span>· corrigé</span> : null}
          </div>

          {canEdit && !editing ? (
            <button
              type="button"
              className="dj-btn dj-btn--ghost"
              style={{ height: 28, fontSize: 12, alignSelf: "flex-start", color: outbound ? "#fff" : undefined }}
              onClick={() => setEditing(true)}
            >
              Corriger la transcription
            </button>
          ) : null}

          {canEdit && editing ? (
            <form
              action={correctAction}
              style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}
            >
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="messageId" value={messageId} />
              <textarea
                name="correctedText"
                defaultValue={transcription.correctedText ?? transcription.originalText}
                rows={2}
                className="dj-input"
                style={{ height: "auto", padding: "8px 10px", color: "var(--text-1)" }}
              />
              <div style={{ fontSize: 10, color: muted }}>
                L&apos;original est conservé : « {transcription.originalText} »
              </div>
              {correctState && !correctState.ok ? (
                <span className="dj-error">{correctState.error}</span>
              ) : null}
              <div style={{ display: "flex", gap: 6 }}>
                <SubmitButton>Enregistrer</SubmitButton>
                <button
                  type="button"
                  className="dj-btn dj-btn--ghost"
                  style={{ height: 34, fontSize: 12 }}
                  onClick={() => setEditing(false)}
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
