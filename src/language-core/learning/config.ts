/**
 * Configuration du Learning Loop — PUR. Poids et seuils de PROPOSITION.
 * Aucun seuil ne déclenche une promotion : ils gouvernent seulement quel
 * `scopeSuggestion` est proposé au reviewer humain.
 */

export type LearningThresholds = {
  minOccurrences: number;
  minOrganizations: number;
  minCorrections: number;
  minConfidence: number;
  staleDays: number;
};

export const DEFAULT_THRESHOLDS: LearningThresholds = {
  minOccurrences: 3,
  minOrganizations: 3,
  minCorrections: 2,
  minConfidence: 0.35,
  staleDays: 120,
};

/** Une correction humaine pèse plus qu'une simple observation (§14). */
export const CORRECTION_WEIGHT = 3;
export const OBSERVATION_WEIGHT = 1;
/** Bonus d'un signal « no-match » (expression fréquente non reconnue). */
export const NO_MATCH_WEIGHT = 1.5;
