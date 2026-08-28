"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  approveCampaignAction,
  cancelCampaignAction,
  previewCampaignAction,
  sendCampaignAction,
} from "@/server/actions/marketing.actions";
import type { CampaignPreview } from "@/server/marketing/campaign-service";
import { Card } from "@/components/ui";

export function CampaignActions({
  campaignId,
  status,
  canManage,
  canSend,
}: {
  campaignId: string;
  status: string;
  canManage: boolean;
  canSend: boolean;
}) {
  const router = useRouter();
  const [previewState, preview, previewPending] = useActionState(previewCampaignAction, null);
  const [approveState, approve] = useActionState(approveCampaignAction, null);
  const [sendState, send] = useActionState(sendCampaignAction, null);
  const [cancelState, cancel] = useActionState(cancelCampaignAction, null);

  useEffect(() => {
    if (approveState?.ok || sendState?.ok || cancelState?.ok) router.refresh();
  }, [approveState, sendState, cancelState, router]);

  const p: CampaignPreview | null = previewState?.ok ? previewState.data : null;
  const isDraft = status === "DRAFT";
  const isReady = status === "READY" || status === "PARTIAL";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <form action={preview}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <button type="submit" className="dj-btn dj-btn--outline" disabled={previewPending}>
            {previewPending ? "Calcul…" : "Aperçu de l'audience"}
          </button>
        </form>

        {canManage && isDraft ? (
          <form action={approve}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <button type="submit" className="dj-btn dj-btn--primary">
              Approuver
            </button>
          </form>
        ) : null}

        {canSend && isReady ? (
          <form
            action={send}
            onSubmit={(e) => {
              if (!confirm("Envoyer maintenant aux clients inclus ? Les opt-out et les clients hors fenêtre 24 h sans modèle sont exclus.")) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="campaignId" value={campaignId} />
            <button type="submit" className="dj-btn dj-btn--primary">
              Envoyer la campagne
            </button>
          </form>
        ) : null}

        {canManage && status !== "SENT" && status !== "SENDING" && status !== "CANCELLED" ? (
          <form action={cancel}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <button type="submit" className="dj-btn dj-btn--ghost">
              Annuler
            </button>
          </form>
        ) : null}
      </div>

      {approveState && !approveState.ok ? (
        <div className="dj-alert dj-alert--error">{approveState.error}</div>
      ) : null}
      {sendState && !sendState.ok ? (
        <div className="dj-alert dj-alert--error">{sendState.error}</div>
      ) : null}
      {sendState?.ok ? (
        <div className="dj-alert dj-alert--ok">
          Envoi terminé : {sendState.data.sent} envoyé(s), {sendState.data.skipped} ignoré(s),{" "}
          {sendState.data.failed} en échec sur {sendState.data.total}.
        </div>
      ) : null}
      {previewState && !previewState.ok ? (
        <div className="dj-alert dj-alert--error">{previewState.error}</div>
      ) : null}

      {p ? (
        <Card>
          <h3 style={{ margin: "0 0 10px", fontSize: 17 }}>Aperçu de l&apos;audience</h3>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-2)" }}>{p.audienceLabel}</p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
            <Stat label="Inclus" value={p.includedCount} strong />
            <Stat label="Exclus — opt-out" value={p.excludedOptOutCount} />
            <Stat label="Exclus — injoignables" value={p.excludedUnreachableCount} />
            <Stat label="Correspondances" value={p.totalMatched} />
          </div>
          {p.capped ? (
            <div className="dj-alert dj-alert--info" style={{ marginBottom: 12 }}>
              Audience volumineuse : l&apos;aperçu est plafonné. Affinez les critères.
            </div>
          ) : null}
          <div className="dj-alert dj-alert--info" style={{ marginBottom: 12 }}>
            Canal : {p.channel}. Dans la fenêtre 24 h → message de session ; hors
            fenêtre → uniquement le modèle {p.templateName ? `« ${p.templateName} »` : "(aucun défini → ces clients seront exclus)"}.
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Exemples de messages
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {p.sampleIncluded.map((s) => (
              <div key={s.id} style={{ fontSize: 13, padding: "8px 10px", background: "var(--card-alt)", borderRadius: 10 }}>
                <strong>{s.name}</strong> — {s.message}
              </div>
            ))}
          </div>
          {p.sampleExcludedOptOut.length > 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 10 }}>
              Exclus (opt-out) : {p.sampleExcludedOptOut.join(", ")}…
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <div className="tnum" style={{ fontSize: strong ? 26 : 20, fontFamily: "var(--font-display)" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
    </div>
  );
}
