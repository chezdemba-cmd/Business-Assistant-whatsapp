import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { lcDb } from "@/language-core/db";
import { learningCandidateStats } from "@/language-core/learning-candidate-service";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";

export const metadata = { title: "Djeli Language Core — Djeli" };

export default async function LanguageDashboardPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "language.admin")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="Djeli Language Core" />;
  }

  const [byStatus, byScope, byLang, domains, apps, candidates, recentMetrics] =
    await Promise.all([
      lcDb.languageEntry.groupBy({ by: ["status"], _count: { _all: true } }),
      lcDb.languageEntry.groupBy({ by: ["scope"], _count: { _all: true } }),
      lcDb.languageEntry.groupBy({ by: ["language"], _count: { _all: true } }),
      lcDb.languageDomain.count(),
      lcDb.languageApplication.count(),
      learningCandidateStats(),
      lcDb.languageResolveMetric.findMany({ orderBy: { day: "desc" }, take: 7 }),
    ]);

  const resolveTotal = recentMetrics.reduce((s, m) => s + m.resolveCount, 0);
  const matchTotal = recentMetrics.reduce((s, m) => s + m.matchCount, 0);

  const tiles: Array<[string, string]> = [
    ["Entrées validées", String(byStatus.find((s) => s.status === "VALIDATED")?._count._all ?? 0)],
    ["Suggestions", String(byStatus.find((s) => s.status === "SUGGESTED")?._count._all ?? 0)],
    ["Domaines", String(domains)],
    ["Applications", String(apps)],
    ["Corrections (candidats 6D)", `${candidates.total} · ${candidates.shareable} partageables`],
    ["Resolve 7 j", `${resolveTotal} appels · ${matchTotal} matchs`],
  ];

  return (
    <>
      <PageHeader
        title="Djeli Language Core"
        subtitle="Brique linguistique réutilisable (BM / FR / MIXED). OBSERVATION ≠ SUGGESTION ≠ VALIDÉ."
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["entries", "suggestions", "learning", "domains", "applications", "data"].map((p) => (
          <Link key={p} href={`/language/${p}`} className="dj-btn dj-btn--outline" style={{ height: 34, fontSize: 13 }}>
            {{ entries: "Entrées", suggestions: "Suggestions", learning: "Learning Loop", domains: "Domaines", applications: "Applications", data: "Import / Export" }[p]}
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 20 }}>
        {tiles.map(([k, v]) => (
          <Card key={k} style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 8 }}>{k}</div>
            <div className="tnum" style={{ fontSize: 18, fontFamily: "var(--font-display)" }}>{v}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Répartition</h3>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13 }}>
          <div>
            <strong>Par scope</strong>
            {byScope.map((s) => <div key={s.scope}>{s.scope} : {s._count._all}</div>)}
          </div>
          <div>
            <strong>Par langue</strong>
            {byLang.map((s) => <div key={s.language}>{s.language} : {s._count._all}</div>)}
          </div>
          <div>
            <strong>Par statut</strong>
            {byStatus.map((s) => <div key={s.status}><Badge>{s.status}</Badge> {s._count._all}</div>)}
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
          Données de développement marquées DEV/DEMO — pas une référence linguistique officielle.
          Le Learning Loop (agrégation / promotion) est la Phase 6D.
        </p>
      </Card>
    </>
  );
}
