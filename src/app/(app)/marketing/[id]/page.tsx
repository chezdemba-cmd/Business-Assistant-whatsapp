import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { PageHeader, Card } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { getCampaign } from "@/server/marketing/campaign-service";
import { isAppError } from "@/server/errors";
import { formatDateTime } from "@/lib/format";
import { CampaignActions } from "@/components/marketing/CampaignActions";

export const metadata = { title: "Campagne — Djeli" };

const ITEM_LABEL: Record<string, string> = {
  PENDING: "En attente",
  SENDING: "Envoi",
  SENT: "Envoyé",
  SKIPPED: "Ignoré",
  FAILED: "Échec",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "marketing.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="le marketing" />;
  }
  const { id } = await params;

  let campaign;
  try {
    campaign = await getCampaign(ctx.organization.id, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const stats = campaign.stats as { total?: number; sent?: number; skipped?: number; failed?: number } | null;

  return (
    <>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.type} · ${campaign.channel} · statut : ${campaign.status}`}
        actions={
          <Link href="/marketing" className="dj-btn dj-btn--ghost">
            ← Toutes les campagnes
          </Link>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)", marginBottom: 6 }}>
          Message
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
          {campaign.message}
        </p>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
          Créée par {campaign.createdBy.firstName} {campaign.createdBy.lastName} ·{" "}
          {formatDateTime(campaign.createdAt)}
          {campaign.approvedBy
            ? ` · approuvée par ${campaign.approvedBy.firstName} ${campaign.approvedBy.lastName}`
            : ""}
          {campaign.templateName ? ` · modèle : ${campaign.templateName}` : " · pas de modèle WhatsApp"}
        </div>
      </Card>

      <CampaignActions
        campaignId={campaign.id}
        status={campaign.status}
        canManage={can(ctx.role, "marketing.manage")}
        canSend={can(ctx.role, "marketing.send")}
      />

      {campaign.items.length > 0 ? (
        <Card style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 17 }}>
            Destinataires ({campaign.items.length})
            {stats ? ` — ${stats.sent ?? 0} envoyé(s), ${stats.skipped ?? 0} ignoré(s), ${stats.failed ?? 0} en échec` : ""}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {campaign.items.slice(0, 200).map((it) => (
              <div key={it.id} style={{ display: "flex", gap: 10, fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border-soft)" }}>
                <span style={{ flex: 1 }}>{it.customer.displayName}</span>
                <span style={{ color: "var(--text-3)" }}>{ITEM_LABEL[it.status] ?? it.status}</span>
                {it.errorCode ? <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{it.errorCode}</span> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
