import { pageOrgContext } from "@/server/page-context";
import { PageHeader, Card } from "@/components/ui";
import { listSupportTickets } from "@/server/support/support-service";
import { SupportTicketForm } from "@/components/support/SupportForms";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Support — Djeli" };

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  CLOSED: "Clôturé",
};

export default async function SupportPage() {
  const ctx = await pageOrgContext();
  const tickets = await listSupportTickets(ctx.organization.id);

  return (
    <>
      <PageHeader
        title="Support"
        subtitle="Un problème, une question ? Écrivez-nous. Pendant le pilote, nous suivons chaque demande de près."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
        <SupportTicketForm email={ctx.user.email} />

        {tickets.length > 0 ? (
          <Card>
            <h3 style={{ fontSize: 17, margin: "0 0 12px" }}>Vos demandes</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tickets.map((t) => (
                <div key={t.id} style={{ display: "flex", gap: 10, fontSize: 13, padding: "8px 0", borderBottom: "1px solid var(--border-soft)" }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{t.subject}</span>
                  <span style={{ color: "var(--text-3)" }}>{t.type}</span>
                  <span className="dj-badge">{STATUS_LABEL[t.status] ?? t.status}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{formatDateTime(t.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
