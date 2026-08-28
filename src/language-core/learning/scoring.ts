/**
 * Score de confiance d'un candidat — PUR, DÉTERMINISTE, DOCUMENTÉ.
 * Pas de score opaque : `explainScore` produit une liste de facteurs lisibles.
 *
 * Formule (bornée [0,1]) :
 *   base       = min(1, correctionCount / 5) * 0.40
 *              + min(1, occurrenceCount / 10) * 0.20
 *   diversity  = min(1, organizationCount / 3) * 0.20
 *              + min(1, sourceCount / 3) * 0.10
 *   recency    = 0.10 si vue dans les 30 derniers jours, sinon 0
 *   score      = base + diversity + recency
 */

export type CandidateStats = {
  occurrenceCount: number;
  correctionCount: number;
  organizationCount: number;
  sourceCount: number;
  lastSeenAt: Date;
  now?: Date;
};

export type ScoreFactor = { label: string; contribution: number };

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function explainScore(s: CandidateStats): ScoreFactor[] {
  const now = s.now ?? new Date();
  const ageDays = (now.getTime() - s.lastSeenAt.getTime()) / 86_400_000;
  return [
    { label: `${s.correctionCount} correction(s)`, contribution: clamp01(s.correctionCount / 5) * 0.4 },
    { label: `${s.occurrenceCount} occurrence(s)`, contribution: clamp01(s.occurrenceCount / 10) * 0.2 },
    { label: `${s.organizationCount} organisation(s)`, contribution: clamp01(s.organizationCount / 3) * 0.2 },
    { label: `${s.sourceCount} source(s)`, contribution: clamp01(s.sourceCount / 3) * 0.1 },
    { label: ageDays <= 30 ? "vue récemment (≤ 30 j)" : `dernière vue il y a ${Math.round(ageDays)} j`, contribution: ageDays <= 30 ? 0.1 : 0 },
  ];
}

export function calculateCandidateScore(s: CandidateStats): number {
  const total = explainScore(s).reduce((sum, f) => sum + f.contribution, 0);
  return Math.round(clamp01(total) * 1000) / 1000;
}
