import type { LanguageScope } from "@prisma/client";
import type { LearningThresholds } from "./config";

/**
 * SUGGESTION de scope — PUR. C'est une PROPOSITION au reviewer, jamais une
 * décision. Règles prudentes :
 *   - 1 seule organisation                       → ORGANIZATION
 *   - plusieurs organisations, 1 domaine cohérent + seuils atteints → DOMAIN
 *   - GLOBAL  → uniquement multi-domaines / connaissance générale + shareable,
 *              et TOUJOURS soumis à validation humaine finale.
 *   - non anonymisable (shareable = false)       → ORGANIZATION (jamais au-delà)
 */

export type ScopeSuggestionInput = {
  organizationCount: number;
  domainCount: number;
  occurrenceCount: number;
  correctionCount: number;
  confidenceScore: number;
  shareable: boolean;
  thresholds: LearningThresholds;
};

export type ScopeSuggestion = {
  scope: LanguageScope;
  reason: string;
  /** true si le scope proposé exige une validation humaine renforcée. */
  requiresStrongReview: boolean;
};

export function suggestScope(input: ScopeSuggestionInput): ScopeSuggestion {
  const t = input.thresholds;

  if (!input.shareable) {
    return {
      scope: "ORGANIZATION",
      reason: "Données non anonymisables (PII résiduelle) : reste privé à l'organisation.",
      requiresStrongReview: false,
    };
  }
  if (input.organizationCount <= 1) {
    return {
      scope: "ORGANIZATION",
      reason: "Observé dans une seule organisation.",
      requiresStrongReview: false,
    };
  }

  const strongDiversity =
    input.organizationCount >= t.minOrganizations &&
    input.correctionCount >= t.minCorrections &&
    input.confidenceScore >= t.minConfidence;

  const meetsDomain = strongDiversity && input.domainCount === 1;

  const meetsGlobal =
    strongDiversity &&
    input.domainCount > 1 &&
    input.organizationCount >= t.minOrganizations * 2 &&
    input.occurrenceCount >= t.minOccurrences * 3;

  if (meetsGlobal) {
    return {
      scope: "GLOBAL",
      reason: "Multi-domaines, forte diversité — validation humaine finale obligatoire.",
      requiresStrongReview: true,
    };
  }
  if (meetsDomain) {
    return {
      scope: "DOMAIN",
      reason: `Plusieurs organisations (${input.organizationCount}) sur un même domaine.`,
      requiresStrongReview: true,
    };
  }
  return {
    scope: "ORGANIZATION",
    reason: "Diversité insuffisante pour proposer DOMAIN — reste privé pour l'instant.",
    requiresStrongReview: false,
  };
}
