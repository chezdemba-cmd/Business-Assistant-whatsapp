import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizationAdminView } from "@/server/admin/console-service";
import { isAppError } from "@/server/errors";
import { AdminOrgControls } from "@/components/admin/AdminOrgControls";

export const metadata = { title: "Organisation — Console FEREDRON" };

export default async function AdminOrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  let view;
  try {
    view = await getOrganizationAdminView(orgId);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { org, subscription, usage, counts, whatsapp, members, recentErrors } = view;

  return (
    <>
      <Link href="/admin" style={{ fontSize: 13 }}>← Toutes les organisations</Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, margin: "8px 0 4px" }}>{org.name}</h1>
      <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 20 }}>
        {org.slug} · {org.countryCode}/{org.currency} · {org.timezone} · statut {org.status}
        {org.isPilot ? " · pilote" : ""} {org.isDemo ? " · démo" : ""} · créée le{" "}
        {org.createdAt.toLocaleDateString("fr-FR")}
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2 style={sectionH}>Abonnement</h2>
        <p style={{ fontSize: 14, margin: "0 0 14px" }}>
          Offre <strong>{subscription.planName}</strong> · statut {subscription.status}
          {subscription.status === "TRIAL" && subscription.daysLeftInTrial != null
            ? ` · ${subscription.daysLeftInTrial} j d'essai restants`
            : ""}
          {subscription.isTrialExpired ? " · essai expiré" : ""} · facturation {subscription.billingProvider}
        </p>
        <AdminOrgControls
          organizationId={org.id}
          planCode={subscription.planCode}
          subStatus={subscription.status}
          isPilot={org.isPilot}
        />
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={sectionH}>Usage (période courante)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          {usage.map((u) => (
            <div key={u.metric} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>{u.metric} ({u.period})</div>
              <div className="tnum" style={{ fontSize: 18 }}>
                {u.used} / {u.limit == null ? "∞" : u.limit}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={sectionH}>Volumétrie</h2>
        <div style={{ fontSize: 14 }}>
          {counts.products} produits · {counts.customers} clients · {counts.orders} commandes ·{" "}
          {counts.conversations} conversations · {counts.aiRuns} exécutions IA
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={sectionH}>WhatsApp</h2>
        {whatsapp.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--text-3)" }}>Aucune connexion.</p>
        ) : (
          <ul style={{ fontSize: 14, margin: 0, paddingLeft: 18 }}>
            {whatsapp.map((w, i) => (
              <li key={i}>
                {w.displayPhoneNumber ?? "numéro ?"} — {w.status}
                {w.verifiedName ? ` (${w.verifiedName})` : ""}
                {w.lastError ? ` · dernière erreur : ${w.lastError}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={sectionH}>Membres</h2>
        <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
          {members.map((m, i) => (
            <li key={i}>
              {m.user.firstName} {m.user.lastName} — {m.user.email} · {m.role} · {m.status}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 style={sectionH}>Incidents techniques récents</h2>
        {recentErrors.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--text-3)" }}>Aucun incident récent.</p>
        ) : (
          <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
            {recentErrors.map((e, i) => (
              <li key={i}>{e.action} — {e.createdAt.toLocaleString("fr-FR")}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

const sectionH: React.CSSProperties = { fontSize: 15, color: "var(--text-2)", margin: "0 0 10px" };
