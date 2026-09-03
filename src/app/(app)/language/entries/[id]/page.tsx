import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { lcDb } from "@/language-core/db";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import {
  EntryMetaForm,
  EntryStatusActions,
  AddVariantForm,
  AddTranslationForm,
  AddIntentForm,
} from "@/components/language/EntryForms";

export const metadata = { title: "Entrée linguistique — FEREDRON" };

export default async function LanguageEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "language.admin")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="FEREDRON Language Core" />;
  }

  const [entry, domains] = await Promise.all([
    lcDb.languageEntry.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { createdAt: "asc" } },
        translations: { orderBy: { createdAt: "asc" } },
        intentMappings: { orderBy: { createdAt: "asc" } },
        examples: { orderBy: { createdAt: "asc" } },
        revisions: { orderBy: { version: "desc" }, take: 20 },
      },
    }),
    lcDb.languageDomain.findMany({ where: { status: "ACTIVE" }, select: { code: true } }),
  ]);
  if (!entry) notFound();
  const domainCodes = domains.map((d) => d.code);

  return (
    <>
      <Link href="/language/entries" style={{ fontSize: 13, color: "var(--text-3)" }}>← Entrées</Link>
      <PageHeader
        title={entry.canonicalText}
        subtitle={`${entry.language} · ${entry.scope}${entry.domainCode ? ` · ${entry.domainCode}` : ""}${entry.organizationId ? ` · org ${entry.organizationId}` : ""} · v${entry.version}`}
        actions={<Badge variant={entry.status === "VALIDATED" ? "ok" : "default"}>{entry.status}</Badge>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Édition</h3>
            <EntryMetaForm
              entryId={entry.id}
              canonicalText={entry.canonicalText}
              meaning={entry.meaning ?? ""}
              frenchTranslation={entry.frenchTranslation ?? ""}
            />
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Variantes</h3>
            {entry.variants.map((v) => (
              <div key={v.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border-soft)" }}>
                <strong>{v.text}</strong> · {v.variantType} · <Badge>{v.status}</Badge>
              </div>
            ))}
            <div style={{ marginTop: 10 }}><AddVariantForm entryId={entry.id} /></div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Traductions</h3>
            {entry.translations.map((t) => (
              <div key={t.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border-soft)" }}>
                {t.language} : {t.text} · <Badge>{t.status}</Badge>
              </div>
            ))}
            <div style={{ marginTop: 10 }}><AddTranslationForm entryId={entry.id} /></div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Intentions</h3>
            {entry.intentMappings.map((m) => (
              <div key={m.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border-soft)" }}>
                {m.intentCode}{m.domainCode ? ` · ${m.domainCode}` : ""} · <Badge>{m.status}</Badge>
              </div>
            ))}
            <div style={{ marginTop: 10 }}><AddIntentForm entryId={entry.id} domains={domainCodes} /></div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Workflow</h3>
            <EntryStatusActions entryId={entry.id} status={entry.status} />
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 10 }}>
              {entry.validatedByRef
                ? `Validé par ${entry.validatedByRef} le ${entry.validatedAt ? formatDateTime(entry.validatedAt) : "—"}`
                : "Non validé."}
            </p>
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Provenance</h3>
            <div style={{ fontSize: 12 }}>
              <div>source : {entry.source}</div>
              <div>créée par : {entry.createdByRef ?? "—"}</div>
              {entry.provenance ? (
                <pre style={{ fontSize: 10, background: "var(--card-alt)", padding: 8, borderRadius: 8, overflowX: "auto" }}>
                  {JSON.stringify(entry.provenance, null, 2)}
                </pre>
              ) : null}
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Révisions</h3>
            {entry.revisions.map((r) => (
              <div key={r.id} style={{ fontSize: 12, padding: "3px 0", color: "var(--text-2)" }}>
                v{r.version} — {r.changeReason ?? "—"} · {formatDateTime(r.createdAt)}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
