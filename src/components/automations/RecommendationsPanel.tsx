"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  dismissRecommendationAction,
  prepareRecommendationActionAction,
} from "@/server/actions/automations.actions";
import { Card } from "@/components/ui";

export type RecoRow = {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  actionType: string | null;
  detectedAt: string;
};

const PRIORITY: Record<RecoRow["priority"], { label: string; bg: string; fg: string }> = {
  CRITICAL: { label: "Critique", bg: "var(--err-bg, #fde8e8)", fg: "var(--err-fg, #a12020)" },
  HIGH: { label: "Élevée", bg: "#fff1e0", fg: "#8a4b00" },
  MEDIUM: { label: "Moyenne", bg: "var(--card-alt)", fg: "var(--text-2)" },
  LOW: { label: "Basse", bg: "var(--card-alt)", fg: "var(--text-3)" },
};

const ACTION_LABEL: Record<string, string> = {
  PREPARE_REMINDER: "Préparer une relance",
  PREPARE_CAMPAIGN: "Préparer une campagne",
  OPEN_CUSTOMER: "Ouvrir la fiche client",
  OPEN_ORDER: "Ouvrir la commande",
  OPEN_PRODUCT: "Ouvrir le produit",
};

export function RecommendationsPanel({ rows }: { rows: RecoRow[] }) {
  if (rows.length === 0) {
    return (
      <Card style={{ textAlign: "center", padding: "36px 24px" }}>
        <p style={{ margin: 0, color: "var(--text-2)", fontSize: 14 }}>
          Aucune recommandation active. FEREDRON surveille le stock, les créances,
          les commandes et les clients — vous serez alerté dès qu&apos;un point
          mérite votre attention.
        </p>
      </Card>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => (
        <RecommendationCard key={r.id} row={r} />
      ))}
    </div>
  );
}

function RecommendationCard({ row }: { row: RecoRow }) {
  const router = useRouter();
  const [dismissState, dismiss] = useActionState(dismissRecommendationAction, null);
  const [prepState, prepare] = useActionState(prepareRecommendationActionAction, null);

  useEffect(() => {
    if (dismissState?.ok) router.refresh();
  }, [dismissState, router]);
  useEffect(() => {
    if (prepState?.ok) {
      if (prepState.data.redirectTo) router.push(prepState.data.redirectTo);
      else router.refresh();
    }
  }, [prepState, router]);

  const p = PRIORITY[row.priority];

  return (
    <Card style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
        <span
          className="dj-badge"
          style={{ background: p.bg, color: p.fg, fontWeight: 700, flex: "none" }}
        >
          {p.label}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{row.title}</div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4, lineHeight: 1.5 }}>
            {row.description}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {row.actionType ? (
              <form action={prepare}>
                <input type="hidden" name="recommendationId" value={row.id} />
                <button type="submit" className="dj-btn dj-btn--primary" style={{ height: 32, fontSize: 13, padding: "0 14px" }}>
                  {ACTION_LABEL[row.actionType] ?? "Préparer l'action"}
                </button>
              </form>
            ) : null}
            <form action={dismiss}>
              <input type="hidden" name="recommendationId" value={row.id} />
              <button type="submit" className="dj-btn dj-btn--ghost" style={{ height: 32, fontSize: 13, padding: "0 14px" }}>
                Ignorer
              </button>
            </form>
          </div>
          {prepState && !prepState.ok ? (
            <div className="dj-alert dj-alert--error" style={{ marginTop: 10 }}>
              {prepState.error}
            </div>
          ) : null}
          {dismissState && !dismissState.ok ? (
            <div className="dj-alert dj-alert--error" style={{ marginTop: 10 }}>
              {dismissState.error}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
