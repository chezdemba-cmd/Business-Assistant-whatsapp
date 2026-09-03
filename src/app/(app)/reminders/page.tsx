import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { formatAmount, formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge, EmptyState, Alert } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { Pager } from "@/components/Pager";

export const metadata = { title: "Relances — FEREDRON" };

const PER_PAGE = 20;

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  READY: "Prête",
  SENT: "Envoyée (simulation)",
  CANCELLED: "Annulée",
};

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "debts.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="les relances" />;
  }
  const orgId = ctx.organization.id;
  const currency = ctx.organization.currency;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [total, campaigns] = await Promise.all([
    prisma.reminderCampaign.count({ where: { organizationId: orgId } }),
    prisma.reminderCampaign.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        items: { select: { amountDue: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Relances"
        subtitle="Préparation des relances de créances. L'envoi est simulé — WhatsApp n'est pas connecté."
      />

      <Alert kind="info">
        Mode simulation : « envoyer » marque les relances comme envoyées pour le
        suivi, mais aucun message WhatsApp ne part réellement (Phase 5).
      </Alert>

      <div style={{ marginTop: 20 }}>
        {total === 0 ? (
          <EmptyState
            title="Aucune relance préparée"
            message="Sélectionnez des créances dans l'écran Créances pour préparer une campagne."
            action={
              <Link className="dj-btn dj-btn--primary" href="/debts">
                Ouvrir les créances
              </Link>
            }
          />
        ) : (
          <>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "var(--panel)" }}>
                      {["Campagne", "Statut", "Relances", "Montant", "Créée", "Envoyée"].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "14px 16px",
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              color: "var(--text-2)",
                              textTransform: "uppercase",
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => {
                      const amount = c.items.reduce((s, i) => s + i.amountDue, 0);
                      return (
                        <tr key={c.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                          <td style={{ padding: "13px 16px" }}>
                            <Link href={`/reminders/${c.id}`} style={{ fontWeight: 700 }}>
                              {c.name ?? `Campagne du ${formatDateTime(c.createdAt)}`}
                            </Link>
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                              {c.createdBy
                                ? `${c.createdBy.firstName} ${c.createdBy.lastName}`
                                : "Système"}
                            </div>
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <Badge
                              variant={
                                c.status === "SENT"
                                  ? "ok"
                                  : c.status === "CANCELLED"
                                    ? "default"
                                    : "accent"
                              }
                            >
                              {STATUS_LABEL[c.status] ?? c.status}
                            </Badge>
                          </td>
                          <td className="tnum" style={{ padding: "13px 16px" }}>
                            {c.items.length}
                          </td>
                          <td className="tnum" style={{ padding: "13px 16px", fontWeight: 700 }}>
                            {formatAmount(amount, currency)}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--text-3)" }}>
                            {formatDateTime(c.createdAt)}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--text-3)" }}>
                            {c.sentAt ? formatDateTime(c.sentAt) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            <Pager
              basePath="/reminders"
              searchParams={sp}
              page={page}
              total={total}
              perPage={PER_PAGE}
            />
          </>
        )}
      </div>
    </>
  );
}
