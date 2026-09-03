import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { formatAmount, formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge, Alert } from "@/components/ui";
import {
  SendCampaignButton,
  CancelCampaignButton,
} from "@/components/finance/CampaignActions";

export const metadata = { title: "Campagne de relance — FEREDRON" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  READY: "Prête",
  SENT: "Envoyée (simulation)",
  CANCELLED: "Annulée",
};
const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  SENT: "Envoyée (simulation)",
  FAILED: "Échec",
  SKIPPED: "Ignorée",
};

export default async function ReminderCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "debts.read")) notFound();

  const campaign = await prisma.reminderCampaign.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          customer: { select: { id: true, displayName: true, phone: true } },
          order: { select: { id: true, reference: true } },
        },
      },
    },
  });
  if (!campaign) notFound();

  const currency = ctx.organization.currency;
  const canWrite = can(ctx.role, "debts.write");
  const total = campaign.items.reduce((s, i) => s + i.amountDue, 0);
  const sendable = canWrite && (campaign.status === "DRAFT" || campaign.status === "READY");

  return (
    <>
      <Link
        href="/reminders"
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 16 }}
      >
        ← Relances
      </Link>

      <PageHeader
        title={campaign.name ?? `Campagne du ${formatDateTime(campaign.createdAt)}`}
        subtitle={`${campaign.items.length} relance(s) · ${formatAmount(total, currency)} · créée par ${
          campaign.createdBy
            ? `${campaign.createdBy.firstName} ${campaign.createdBy.lastName}`
            : "le système"
        }`}
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Badge
              variant={
                campaign.status === "SENT"
                  ? "ok"
                  : campaign.status === "CANCELLED"
                    ? "default"
                    : "accent"
              }
            >
              {STATUS_LABEL[campaign.status] ?? campaign.status}
            </Badge>
            {sendable ? (
              <SendCampaignButton
                organizationId={ctx.organization.id}
                campaignId={campaign.id}
                itemCount={campaign.items.length}
              />
            ) : null}
            {sendable ? (
              <CancelCampaignButton
                organizationId={ctx.organization.id}
                campaignId={campaign.id}
              />
            ) : null}
          </div>
        }
      />

      <Alert kind={campaign.status === "SENT" ? "ok" : "info"}>
        {campaign.status === "SENT"
          ? `Marquée envoyée le ${campaign.sentAt ? formatDateTime(campaign.sentAt) : "—"} — envoi simulé, aucun message WhatsApp réel.`
          : "Aperçu des messages. L'envoi est simulé : WhatsApp n'est pas connecté (Phase 5)."}
      </Alert>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
        {campaign.items.map((it) => (
          <Card key={it.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div>
                <Link
                  href={`/customers/${it.customer.id}`}
                  style={{ fontSize: 15, fontWeight: 700 }}
                >
                  {it.customer.displayName}
                </Link>
                <div className="tnum" style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {it.customer.phone ?? "sans téléphone"}
                  {it.order ? (
                    <>
                      {" · "}
                      <Link href={`/orders/${it.order.id}`} className="mono">
                        {it.order.reference}
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  className="tnum"
                  style={{ fontFamily: "var(--font-display)", fontSize: 18 }}
                >
                  {formatAmount(it.amountDue, currency)}
                </div>
                <Badge variant={it.status === "SENT" ? "ok" : "default"}>
                  {ITEM_STATUS_LABEL[it.status] ?? it.status}
                </Badge>
              </div>
            </div>
            <p
              style={{
                margin: 0,
                padding: "12px 14px",
                background: "var(--card-alt)",
                borderRadius: 14,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--text-2)",
              }}
            >
              {it.message}
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}
