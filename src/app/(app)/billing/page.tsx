import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { PageHeader, Card } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { getBillingOverview } from "@/server/billing/entitlements";

export const metadata = { title: "Offre & usage — Djeli" };

const METRIC_LABEL: Record<string, string> = {
  AI_REQUESTS: "Requêtes Djeli IA",
  AI_TOKENS: "Jetons IA",
  VOICE_SECONDS: "Secondes de transcription",
  WHATSAPP_MESSAGES: "Messages WhatsApp",
  LANGUAGE_RESOLVES: "Appels Language Core",
  MARKETING_SENDS: "Envois marketing",
};
const FEATURE_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp Business",
  AI: "Djeli IA",
  VOICE: "Djeli Voice",
  AUTOMATIONS: "Automatisations",
  MARKETING: "Marketing",
  LANGUAGE_ADVANCED: "Language Core avancé",
  TEAM: "Équipe",
};

export default async function BillingPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "settings.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="l'offre et l'usage" />;
  }
  const o = await getBillingOverview(ctx.organization.id, ctx.organization.timezone);
  const s = o.subscription;

  return (
    <>
      <PageHeader
        title="Offre & usage"
        subtitle="Votre offre actuelle, votre essai et votre consommation. La facturation du pilote est gérée hors application."
      />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Offre</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26 }}>{s.planName}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Statut</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{s.status}</div>
          </div>
          {s.status === "TRIAL" ? (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Essai</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {s.isTrialExpired
                  ? "expiré"
                  : `${s.daysLeftInTrial ?? 0} jour(s) restant(s)`}
              </div>
            </div>
          ) : null}
        </div>
        {s.status === "TRIAL" && !s.isTrialExpired ? (
          <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--text-2)" }}>
            Votre essai vous donne accès à toutes les fonctionnalités de l&apos;offre {s.planName}.
            À la fin, contactez le support pour choisir votre offre — rien n&apos;est coupé brutalement.
          </p>
        ) : null}
      </Card>

      <h3 style={{ fontSize: 15, margin: "0 0 12px", color: "var(--text-2)" }}>Consommation (période courante)</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 24 }}>
        {o.usage.map((u) => {
          const pct = u.limit && u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
          return (
            <Card key={u.metric} style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                {METRIC_LABEL[u.metric] ?? u.metric} · {u.period === "DAY" ? "jour" : "mois"}
              </div>
              <div className="tnum" style={{ fontSize: 20, margin: "4px 0" }}>
                {u.used} / {u.limit == null ? "∞" : u.limit}
              </div>
              {u.limit != null ? (
                <div style={{ height: 6, borderRadius: 999, background: "var(--border-soft)" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: pct >= 90 ? "var(--accent)" : "var(--green)" }} />
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <h3 style={{ fontSize: 15, margin: "0 0 12px", color: "var(--text-2)" }}>Fonctionnalités incluses</h3>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(o.features).map(([f, on]) => (
            <span
              key={f}
              className="dj-badge"
              style={{ opacity: on ? 1 : 0.4, fontWeight: 600 }}
            >
              {on ? "✓ " : "— "}{FEATURE_LABEL[f] ?? f}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <h3 style={{ fontSize: 17, margin: "0 0 12px" }}>Nos offres</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {o.plans.map((p) => (
            <div
              key={p.code}
              style={{
                border: p.code === s.planCode ? "2px solid var(--accent)" : "1px solid var(--border)",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", margin: "6px 0 10px" }}>{p.description}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                {Object.entries(p.features).filter(([, v]) => v).map(([k]) => FEATURE_LABEL[k] ?? k).join(" · ")}
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 13 }}>
          Pour changer d&apos;offre, <Link href="/support">contactez le support</Link>.
        </p>
      </Card>
    </>
  );
}
