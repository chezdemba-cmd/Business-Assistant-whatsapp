import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { lcDb } from "@/language-core/db";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { EntryStatusActions } from "@/components/language/EntryForms";

export const metadata = { title: "Suggestions linguistiques — Djeli" };

export default async function LanguageSuggestionsPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "language.admin")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="Djeli Language Core" />;
  }

  const pending = await lcDb.languageEntry.findMany({
    where: { status: { in: ["SUGGESTED", "OBSERVED"] }, archivedAt: null },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return (
    <>
      <Link href="/language" style={{ fontSize: 13, color: "var(--text-3)" }}>← Language Core</Link>
      <PageHeader
        title="Suggestions à valider"
        subtitle="Une correction / un import ne devient JAMAIS une connaissance validée sans revue humaine."
      />
      {pending.length === 0 ? (
        <Card><p style={{ margin: 0, color: "var(--text-3)" }}>Rien à valider.</p></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pending.map((e) => (
            <Card key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <Link href={`/language/entries/${e.id}`} style={{ fontWeight: 700 }}>{e.canonicalText}</Link>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {e.language} · {e.scope}{e.domainCode ? ` · ${e.domainCode}` : ""} · {e.source} · {formatDateTime(e.createdAt)}
                </div>
                {e.meaning ? <div style={{ fontSize: 13 }}>{e.meaning}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge>{e.status}</Badge>
                <EntryStatusActions entryId={e.id} status={e.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
