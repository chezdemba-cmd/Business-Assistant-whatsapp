"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaignAction } from "@/server/actions/marketing.actions";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/form";

const TYPES = [
  ["CUSTOMER_REACTIVATION", "Réactivation clients"],
  ["PROMOTION", "Promotion"],
  ["NEW_PRODUCT", "Nouveau produit"],
  ["LOW_ACTIVITY", "Baisse d'activité"],
  ["CUSTOM", "Personnalisée"],
] as const;

const AUDIENCES = [
  ["INACTIVE_CUSTOMERS", "Clients inactifs"],
  ["CUSTOMER_TYPE", "Par type de client"],
  ["AREA", "Par zone / quartier"],
  ["PRODUCT_BUYERS", "Acheteurs d'un produit"],
  ["ALL_OPTED_IN", "Tous les clients (opt-in)"],
] as const;

export function CampaignForm() {
  const router = useRouter();
  const [state, action] = useActionState(createCampaignAction, null);
  const [audience, setAudience] = useState<string>("INACTIVE_CUSTOMERS");

  useEffect(() => {
    if (state?.ok) router.push(`/marketing/${state.data.id}`);
  }, [state, router]);

  return (
    <Card>
      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
        <label style={lbl}>
          Nom de la campagne
          <input name="name" required maxLength={120} className="dj-input" placeholder="Ex : Relance clients grossistes" />
        </label>

        <label style={lbl}>
          Objectif
          <select name="type" className="dj-input" defaultValue="CUSTOMER_REACTIVATION">
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        <label style={lbl}>
          Audience
          <select
            name="audienceType"
            className="dj-input"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            {AUDIENCES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        {audience === "INACTIVE_CUSTOMERS" ? (
          <label style={lbl}>
            Sans commande depuis (jours)
            <input name="inactiveDays" type="number" min={1} defaultValue={60} className="dj-input" style={{ width: 140 }} />
          </label>
        ) : null}
        {audience === "CUSTOMER_TYPE" ? (
          <label style={lbl}>
            Type de client
            <select name="customerType" className="dj-input">
              <option value="">— indifférent —</option>
              <option value="RETAIL">Détail</option>
              <option value="WHOLESALE">Grossiste</option>
              <option value="BUSINESS">Entreprise</option>
            </select>
          </label>
        ) : null}
        {audience === "AREA" ? (
          <label style={lbl}>
            Zone / quartier
            <input name="area" className="dj-input" placeholder="Ex : Badalabougou" />
          </label>
        ) : null}
        {audience === "PRODUCT_BUYERS" ? (
          <label style={lbl}>
            Identifiant produit
            <input name="productId" className="dj-input" placeholder="ID du produit acheté" />
          </label>
        ) : null}

        <label style={lbl}>
          Message (laisser vide pour un modèle par défaut)
          <textarea
            name="message"
            maxLength={900}
            rows={4}
            className="dj-input"
            placeholder="Bonjour {{name}}, …  ({{name}} sera remplacé par le nom du client)"
          />
        </label>

        <details style={{ fontSize: 13, color: "var(--text-3)" }}>
          <summary style={{ cursor: "pointer" }}>Modèle WhatsApp (envoi hors fenêtre 24 h)</summary>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <label style={lbl}>
              Nom du modèle approuvé
              <input name="templateName" className="dj-input" placeholder="ex : reactivation_client" />
            </label>
            <label style={lbl}>
              Langue
              <input name="templateLang" className="dj-input" defaultValue="fr" style={{ width: 90 }} />
            </label>
          </div>
          <p style={{ margin: "8px 0 0" }}>
            Sans modèle, les clients hors de la fenêtre de 24 h seront exclus de
            l&apos;envoi (règle Meta).
          </p>
        </details>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <SubmitButton>Créer le brouillon</SubmitButton>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Vous validerez l&apos;audience et le message à l&apos;étape suivante.
          </span>
        </div>
        {state && !state.ok ? (
          <div className="dj-alert dj-alert--error">{state.error}</div>
        ) : null}
      </form>
    </Card>
  );
}

const lbl: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
};
