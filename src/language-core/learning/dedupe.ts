import { createHash } from "node:crypto";
import type { LanguageCode, LanguageScope, LearningCandidateType } from "@prisma/client";

/**
 * Clé de déduplication d'un candidat — PUR. Un même pattern ne crée jamais
 * plusieurs candidats : `recomputeLearningCandidates` fait un `upsert` sur
 * cette clé (idempotent, §18, §19, §54).
 */
export function candidateDedupeKey(input: {
  normalizedText: string;
  language: LanguageCode;
  candidateType: LearningCandidateType;
  domainCode: string | null;
  scopeSuggestion: LanguageScope;
  organizationId: string | null;
}): string {
  return [
    input.candidateType,
    input.language,
    input.scopeSuggestion,
    input.domainCode ?? "-",
    input.scopeSuggestion === "ORGANIZATION" ? input.organizationId ?? "-" : "-",
    input.normalizedText,
  ].join("|");
}

/** Hash anonyme et stable d'un organizationId (jamais l'id en clair au reviewer). */
export function organizationHash(organizationId: string | null | undefined): string | null {
  if (!organizationId) return null;
  return createHash("sha256").update(`djeli-org:${organizationId}`).digest("hex").slice(0, 16);
}
