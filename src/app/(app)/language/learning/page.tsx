import Link from "next/link";
import type { LanguageCode, LearningCandidateStatus, LearningCandidateType } from "@prisma/client";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { learningDashboardStats } from "@/language-core/learning/metrics";
import { listCandidates } from "@/language-core/learning/queries";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { RecomputeButton } from "@/components/language/LearningForms";

export const metadata = { title: "Learning Loop — Djeli" };

export default async function LearningQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "language.review")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="le Learning Loop" />;
  }

  const [stats, candidates] = await Promise.all([
    learningDashboardStats(),
    listCandidates({
      language: (sp.language as LanguageCode) || undefined,
      domainCode: sp.domain || undefined,
      type: (sp.type as LearningCandidateType) || undefined,
      status: (sp.status as LearningCandidateStatus) || undefined,
      minScore: sp.minScore ? Number(sp.minScore) : undefined,
      limit: 100,
    }),
  ]);

  const tiles: Array<[string, string]> = [
    ["Observations", String(stats.observations)],
    ["Corrections", String(stats.corrections)],
    ["Candidats", String(stats.candidates)],
    ["À revoir", String(stats.reviewPending)],
    ["Approuvés / Promus", `${stats.approved} / ${stats.promoted}`],
    ["Conflits", String(stats.conflicts)],
    ["Taux d'acceptation", stats.candidateAcceptanceRate == null ? "—" : `${Math.round(stats.candidateAcceptanceRate * 100)} %`],
    ["Match / No-match 30 j", `${stats.resolve30d.matchCount} / ${stats.resolve30d.noMatchCount}`],
  ];

  return (
    <>
      <Link href="/language" style={{ fontSize: 13, color: "var(--text-3)" }}>← Language Core</Link>
      <PageHeader
        title="Learning Loop"
        subtitle="Observation → Correction → Cluster → Candidat → Revue humaine. Aucune promotion automatique."
        actions={<RecomputeButton />}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 18 }}>
        {tiles.map(([k, v]) => (
          <Card key={k} style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>{k}</div>
            <div className="tnum" style={{ fontSize: 17, fontFamily: "var(--font-display)" }}>{v}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--panel)" }}>
                {["Candidat", "Type", "Langue", "Scope proposé", "Occ.", "Org.", "Corr.", "Score", "Statut"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontSize: 11, textTransform: "uppercase", color: "var(--text-2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <Link href={`/language/learning/${c.id}`} style={{ fontWeight: 700 }}>{c.canonicalText}</Link>
                    {c.originalPattern && c.originalPattern !== c.normalizedText ? (
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>de « {c.originalPattern} »</div>
                    ) : null}
                  </td>
                  <td style={{ padding: "10px 14px" }}>{c.candidateType}</td>
                  <td style={{ padding: "10px 14px" }}>{c.language}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {c.scopeSuggestion}{c.domainCode ? ` · ${c.domainCode}` : ""}
                    {!c.shareable ? <Badge variant="accent"> privé</Badge> : null}
                  </td>
                  <td className="tnum" style={{ padding: "10px 14px" }}>{c.occurrenceCount}</td>
                  <td className="tnum" style={{ padding: "10px 14px" }}>{c.organizationCount}</td>
                  <td className="tnum" style={{ padding: "10px 14px" }}>{c.correctionCount}</td>
                  <td className="tnum" style={{ padding: "10px 14px" }}>{c.confidenceScore.toFixed(2)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge variant={c.status === "PROMOTED" ? "ok" : c.status === "CONFLICT" ? "accent" : "default"}>{c.status}</Badge>
                    {c.stale ? <span style={{ fontSize: 10, color: "var(--warn-fg)" }}> stale</span> : null}
                  </td>
                </tr>
              ))}
              {candidates.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 20, color: "var(--text-3)" }}>Aucun candidat — lancez un recompute après des corrections.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
        Dernier recompute d&apos;après les données actuelles. Idempotent : relançable sans doublon.
      </p>
    </>
  );
}
