import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { lcDb } from "@/language-core/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { CreateDomainForm } from "@/components/language/EntryForms";

export const metadata = { title: "Domaines linguistiques — Djeli" };

export default async function LanguageDomainsPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "language.admin")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="Djeli Language Core" />;
  }
  const domains = await lcDb.languageDomain.findMany({ orderBy: { code: "asc" } });

  return (
    <>
      <Link href="/language" style={{ fontSize: 13, color: "var(--text-3)" }}>← Language Core</Link>
      <PageHeader title="Domaines" subtitle="commerce, health, agriculture… — une même expression peut avoir un sens par domaine." />
      <Card style={{ marginBottom: 16 }}><CreateDomainForm /></Card>
      <Card>
        {domains.map((d) => (
          <div key={d.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-soft)", fontSize: 13 }}>
            <strong className="mono">{d.code}</strong>
            <span>{d.name}</span>
            <Badge>{d.status}</Badge>
            {d.description ? <span style={{ color: "var(--text-3)" }}>· {d.description}</span> : null}
          </div>
        ))}
        {domains.length === 0 ? <p style={{ margin: 0, color: "var(--text-3)" }}>Aucun domaine.</p> : null}
      </Card>
    </>
  );
}
