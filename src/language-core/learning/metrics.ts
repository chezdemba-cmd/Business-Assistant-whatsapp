import "server-only";
import { lcDb } from "../db";

/** Tableau de bord Learning — comptages simples, pas d'analytics avancé (§37, §38). */
export async function learningDashboardStats() {
  const [
    observations,
    corrections,
    byStatus,
    byLang,
    byType,
    metrics,
  ] = await Promise.all([
    lcDb.languageObservation.count(),
    lcDb.languageCorrection.count(),
    lcDb.learningCandidate.groupBy({ by: ["status"], _count: { _all: true } }),
    lcDb.learningCandidate.groupBy({ by: ["language"], _count: { _all: true } }),
    lcDb.learningCandidate.groupBy({ by: ["candidateType"], _count: { _all: true } }),
    lcDb.languageResolveMetric.findMany({ orderBy: { day: "desc" }, take: 30 }),
  ]);

  const count = (s: string) => byStatus.find((x) => x.status === s)?._count._all ?? 0;
  const approved = count("APPROVED");
  const rejected = count("REJECTED");
  const promoted = count("PROMOTED");
  const reviewed = approved + rejected + promoted;

  const resolveCount = metrics.reduce((a, m) => a + m.resolveCount, 0);
  const matchCount = metrics.reduce((a, m) => a + m.matchCount, 0);
  const noMatchCount = metrics.reduce((a, m) => a + m.noMatchCount, 0);

  const topDomains = await lcDb.learningCandidate.groupBy({
    by: ["domainCode"],
    _count: { _all: true },
    orderBy: { _count: { domainCode: "desc" } },
    take: 5,
  });

  return {
    observations,
    corrections,
    candidates: byStatus.reduce((a, x) => a + x._count._all, 0),
    reviewPending: count("REVIEW_PENDING") + count("NEW"),
    approved,
    rejected,
    promoted,
    conflicts: count("CONFLICT"),
    stale: await lcDb.learningCandidate.count({ where: { stale: true } }),
    byLanguage: byLang.map((x) => ({ language: x.language, count: x._count._all })),
    byType: byType.map((x) => ({ type: x.candidateType, count: x._count._all })),
    topDomains: topDomains.map((x) => ({ domain: x.domainCode ?? "—", count: x._count._all })),
    resolve30d: { resolveCount, matchCount, noMatchCount },
    matchRate: resolveCount ? matchCount / resolveCount : null,
    noMatchRate: resolveCount ? noMatchCount / resolveCount : null,
    /** candidats acceptés / candidats revus (§38). */
    candidateAcceptanceRate: reviewed ? (approved + promoted) / reviewed : null,
  };
}
