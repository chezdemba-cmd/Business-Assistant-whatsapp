import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { listCampaigns } from "@/server/marketing/campaign-service";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Marketing — FEREDRON" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  READY: "Prête",
  SCHEDULED: "Planifiée",
  SENDING: "Envoi en cours",
  SENT: "Envoyée",
  PARTIAL: "Partiellement envoyée",
  FAILED: "Échec",
  CANCELLED: "Annulée",
};

export default async function MarketingPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "marketing.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="le marketing" />;
  }
  const canManage = can(ctx.role, "marketing.manage");
  const campaigns = await listCampaigns(ctx.organization.id);

  return (
    <>
      <PageHeader
        title="Campagnes marketing"
        subtitle="Préparez des messages ciblés. L'audience et le contenu sont toujours validés avant envoi, et les clients désinscrits sont exclus."
        actions={
          canManage ? (
            <Link href="/marketing/new" className="dj-btn dj-btn--primary">
              Nouvelle campagne
            </Link>
          ) : undefined
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title="Aucune campagne"
          message="Créez une campagne de réactivation, de promotion ou de nouveau produit. Rien n'est envoyé sans votre validation."
          action={
            canManage ? (
              <Link href="/marketing/new" className="dj-btn dj-btn--primary">
                Nouvelle campagne
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {campaigns.map((c) => (
            <Link key={c.id} href={`/marketing/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Card style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
                    {c.type} · {c.channel} · {c._count.items} destinataire(s) · créée le {formatDateTime(c.createdAt)}
                  </div>
                </div>
                <span className="dj-badge">{STATUS_LABEL[c.status] ?? c.status}</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
