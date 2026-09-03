import {
  getActivationBreakdown,
  getPlatformUsage,
} from "@/server/analytics/product-metrics";

export const metadata = { title: "Analytics — Console FEREDRON" };

export default async function AdminAnalyticsPage() {
  const [act, usage] = await Promise.all([getActivationBreakdown(), getPlatformUsage()]);

  const rows: Array<[string, string | number]> = [
    ["Organisations", act.total],
    ["— avec produits", act.hasProducts],
    ["— avec clients", act.hasCustomers],
    ["— avec commandes", act.hasOrders],
    ["— WhatsApp connecté", act.hasWhatsApp],
    ["— ont utilisé FEREDRON IA", act.usedAi],
    ["Organisations ACTIVÉES (§46)", act.activated],
    ["Organisations actives 7 j", usage.activeOrganizations7d],
    ["Utilisateurs actifs 24 h", usage.activeUsers24h],
    ["Commandes créées 7 j / 30 j", `${usage.ordersCreated7d} / ${usage.ordersCreated30d}`],
    ["Conversations 7 j", usage.conversations7d],
    ["Exécutions IA 7 j", usage.aiRuns7d],
    ["Transcriptions Voice 7 j", usage.voiceTranscriptions7d],
    ["Recommandations suivies 30 j", usage.recommendationsActed30d],
    ["Envois marketing 30 j", usage.marketingSends30d],
  ];

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 6px" }}>
        Analytics plateforme
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 20px" }}>
        Agrégats uniquement — aucun contenu privé. Base du suivi d&apos;activation
        et des KPI pilote.
      </p>
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {rows.map(([k, v], i) => (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 16px",
              fontSize: 14,
              background: i % 2 ? "var(--card-alt)" : "transparent",
            }}
          >
            <span>{k}</span>
            <strong className="tnum">{v}</strong>
          </div>
        ))}
      </div>
    </>
  );
}
