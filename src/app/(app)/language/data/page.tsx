import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { lcDb } from "@/language-core/db";
import { listLearningCandidates } from "@/language-core/learning-candidate-service";
import { Card, PageHeader } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { ImportForm, ExportPanel } from "@/components/language/EntryForms";
import { LearningDatasetExport } from "@/components/language/LearningForms";

export const metadata = { title: "Import / Export linguistique — FEREDRON" };

export default async function LanguageDataPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "language.admin")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="FEREDRON Language Core" />;
  }

  const [domains, datasets, candidates] = await Promise.all([
    lcDb.languageDomain.findMany({ where: { status: "ACTIVE" }, select: { code: true } }),
    lcDb.languageDatasetSource.findMany({ orderBy: { importedAt: "desc" }, take: 10 }),
    listLearningCandidates({ limit: 15 }),
  ]);

  return (
    <>
      <Link href="/language" style={{ fontSize: 13, color: "var(--text-3)" }}>← Language Core</Link>
      <PageHeader title="Import / Export" subtitle="Import → SUGGESTED. Export → GLOBAL + DOMAIN VALIDATED, sans PII." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        <Card>
          <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Importer</h3>
          <ImportForm domains={domains.map((d) => d.code)} />
          {datasets.length > 0 ? (
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-3)" }}>
              <strong>Datasets enregistrés :</strong>
              {datasets.map((d) => <div key={d.id}>{d.name} — {d.license}</div>)}
            </div>
          ) : null}
        </Card>

        <Card>
          <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Exporter</h3>
          <ExportPanel />
        </Card>
      </div>

      <Card style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Dataset d&apos;apprentissage (Learning Loop)</h3>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 10px" }}>
          Uniquement candidats APPROVED / PROMOTED, `shareable`, texte ré-anonymisé — prêt pour évaluation ASR/LLM future. Aucun entraînement ici.
        </p>
        <LearningDatasetExport />
      </Card>

      <Card style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Corrections brutes récentes</h3>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 10px" }}>
          Matière première — AUCUNE promotion automatique. `null` = non partageable (PII résiduelle).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          {candidates.map((c) => (
            <div key={c.correctionId} style={{ borderBottom: "1px solid var(--border-soft)", paddingBottom: 4 }}>
              <span style={{ color: "var(--text-3)" }}>{c.detectedLanguage} · {c.domainCode ?? "—"}</span>{" "}
              « {c.originalText} » → « {c.correctedText} »
              {c.sanitizedText ? <span style={{ color: "var(--ok-fg)" }}> · partageable</span> : <span style={{ color: "var(--warn-fg)" }}> · non partageable</span>}
            </div>
          ))}
          {candidates.length === 0 ? <span style={{ color: "var(--text-3)" }}>Aucune correction.</span> : null}
        </div>
      </Card>
    </>
  );
}
