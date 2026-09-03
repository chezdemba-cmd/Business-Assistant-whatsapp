import Link from "next/link";
import { listOrganizations, platformMetrics } from "@/server/admin/console-service";

export const metadata = { title: "Organisations — Console FEREDRON" };

export default async function AdminOrgsPage() {
  const [orgs, metrics] = await Promise.all([listOrganizations(200), platformMetrics()]);

  return (
    <>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Metric label="Organisations" value={metrics.organizations} />
        <Metric label="Pilotes" value={metrics.pilots} />
        <Metric label="Abonnements actifs" value={metrics.activeSubscriptions} />
        <Metric label="Essais en cours" value={metrics.trials} />
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "var(--card-alt)" }}>
              <Th>Organisation</Th>
              <Th>Pays</Th>
              <Th>Offre</Th>
              <Th>Abonnement</Th>
              <Th>Membres</Th>
              <Th>WhatsApp</Th>
              <Th>Créée</Th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <Td>
                  <Link href={`/admin/${o.id}`} style={{ fontWeight: 600 }}>
                    {o.name}
                  </Link>
                  {o.isPilot ? <span className="dj-badge" style={{ marginLeft: 8 }}>pilote</span> : null}
                  {o.isDemo ? <span className="dj-badge" style={{ marginLeft: 8 }}>démo</span> : null}
                </Td>
                <Td>{o.countryCode}/{o.currency}</Td>
                <Td>{o.planCode ?? "—"}</Td>
                <Td>{o.subStatus ?? "—"}</Td>
                <Td>{o.members}</Td>
                <Td>{o.whatsappConnected ? "connecté" : "—"}</Td>
                <Td>{o.createdAt.toLocaleDateString("fr-FR")}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", minWidth: 150 }}>
      <div className="tnum" style={{ fontSize: 26, fontFamily: "var(--font-display)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{label}</div>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: "10px 12px", fontWeight: 700 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 12px" }}>{children}</td>;
}
