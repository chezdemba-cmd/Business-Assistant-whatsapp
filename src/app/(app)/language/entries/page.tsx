import Link from "next/link";
import type { LanguageCode, LanguageEntryStatus, LanguageScope } from "@prisma/client";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { lcDb } from "@/language-core/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { CreateEntryForm } from "@/components/language/EntryForms";

export const metadata = { title: "Entrées linguistiques — Djeli" };

export default async function LanguageEntriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "language.admin")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="Djeli Language Core" />;
  }

  const [entries, domains] = await Promise.all([
    lcDb.languageEntry.findMany({
      where: {
        ...(sp.status ? { status: sp.status as LanguageEntryStatus } : {}),
        ...(sp.scope ? { scope: sp.scope as LanguageScope } : {}),
        ...(sp.language ? { language: sp.language as LanguageCode } : {}),
        archivedAt: null,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { _count: { select: { variants: true, translations: true, intentMappings: true } } },
    }),
    lcDb.languageDomain.findMany({ where: { status: "ACTIVE" }, select: { code: true } }),
  ]);

  return (
    <>
      <Link href="/language" style={{ fontSize: 13, color: "var(--text-3)" }}>← Language Core</Link>
      <PageHeader title="Entrées linguistiques" subtitle="Créer, valider, versionner." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "start" }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--panel)" }}>
                  {["Canonique", "Langue", "Scope", "Statut", "v.", "V/T/I"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontSize: 11, textTransform: "uppercase", color: "var(--text-2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <Link href={`/language/entries/${e.id}`} style={{ fontWeight: 700 }}>{e.canonicalText}</Link>
                      {e.meaning ? <div style={{ fontSize: 11, color: "var(--text-3)" }}>{e.meaning}</div> : null}
                    </td>
                    <td style={{ padding: "10px 14px" }}>{e.language}</td>
                    <td style={{ padding: "10px 14px" }}>{e.scope}{e.domainCode ? ` · ${e.domainCode}` : ""}</td>
                    <td style={{ padding: "10px 14px" }}><Badge variant={e.status === "VALIDATED" ? "ok" : "default"}>{e.status}</Badge></td>
                    <td className="tnum" style={{ padding: "10px 14px" }}>{e.version}</td>
                    <td className="tnum" style={{ padding: "10px 14px" }}>
                      {e._count.variants}/{e._count.translations}/{e._count.intentMappings}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 20, color: "var(--text-3)" }}>Aucune entrée.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Nouvelle entrée</h3>
          <CreateEntryForm domains={domains.map((d) => d.code)} />
        </Card>
      </div>
    </>
  );
}
