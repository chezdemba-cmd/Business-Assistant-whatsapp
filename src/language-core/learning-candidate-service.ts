import "server-only";
import { lcDb } from "./db";

/**
 * PRÉPARATION Phase 6D (Learning Loop). Ce service EXPOSE seulement la matière
 * première (corrections) sous forme de candidats. Il NE FAIT PAS :
 *  - de clustering / regroupement multi-occurrences ;
 *  - de scoring d'accord inter-annotateurs ;
 *  - de promotion automatique vers LanguageEntry ;
 *  - d'approbation semi-automatique ;
 *  - de fine-tuning.
 * Tout cela est explicitement hors périmètre de la Phase 6C.
 */

export type LearningCandidate = {
  correctionId: string;
  originalText: string;
  correctedText: string;
  /** null si non partageable (PII résiduelle). */
  sanitizedText: string | null;
  detectedLanguage: string;
  domainCode: string | null;
  context: string | null;
  consentStatus: string;
  createdAt: Date;
};

export async function listLearningCandidates(opts: {
  domainCode?: string | null;
  onlyShareable?: boolean;
  limit?: number;
} = {}): Promise<LearningCandidate[]> {
  const rows = await lcDb.languageCorrection.findMany({
    where: {
      ...(opts.onlyShareable ? { sanitizedText: { not: null } } : {}),
      ...(opts.domainCode
        ? { observation: { domainCode: opts.domainCode } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(500, Math.max(1, opts.limit ?? 100)),
    include: { observation: { select: { domainCode: true } } },
  });

  return rows.map((c) => ({
    correctionId: c.id,
    originalText: c.originalText,
    correctedText: c.correctedText,
    sanitizedText: c.sanitizedText,
    detectedLanguage: c.detectedLanguage,
    domainCode: c.observation.domainCode,
    context: c.context,
    consentStatus: c.consentStatus,
    createdAt: c.createdAt,
  }));
}

export async function learningCandidateStats() {
  const [total, shareable, withConsent] = await Promise.all([
    lcDb.languageCorrection.count(),
    lcDb.languageCorrection.count({ where: { sanitizedText: { not: null } } }),
    lcDb.languageCorrection.count({ where: { consentStatus: "GRANTED" } }),
  ]);
  return { total, shareable, withConsent };
}
