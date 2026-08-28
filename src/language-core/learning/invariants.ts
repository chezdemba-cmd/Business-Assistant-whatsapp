/**
 * INVARIANTS du Learning Loop — PUR.
 *
 * §1 / §63 : AUCUNE DONNÉE NE DEVIENT « GLOBAL VALIDATED » AUTOMATIQUEMENT.
 * Une promotion de candidat ne peut créer qu'une connaissance `SUGGESTED` ;
 * le passage à `VALIDATED` reste une action humaine séparée (permission
 * `language.validate`), et `GLOBAL` exige en plus une revue renforcée.
 */
export const PROMOTION_TARGET_STATUS = "SUGGESTED" as const;

export class LearningInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearningInvariantError";
  }
}

/** Garde-fou : la promotion ne doit jamais viser un statut validé/global-auto. */
export function assertPromotionStatus(status: string): asserts status is "SUGGESTED" {
  if (status !== PROMOTION_TARGET_STATUS) {
    throw new LearningInvariantError(
      `Promotion invariant violé : statut « ${status} » — seul « SUGGESTED » est autorisé.`,
    );
  }
}

/** true si un scope proposé nécessite une double validation humaine avant VALIDATED. */
export function requiresFinalHumanValidation(scope: string): boolean {
  return scope === "GLOBAL" || scope === "DOMAIN";
}
