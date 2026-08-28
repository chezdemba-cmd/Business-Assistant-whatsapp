/**
 * Politique de validité de session — PUR (§5). Une session (JWT) est rejetée si
 * elle a été émise AVANT un changement de mot de passe ou une révocation
 * globale explicite, moins une petite tolérance.
 */

export const SESSION_LEEWAY_MS = 2000;

export type SessionRevocationMarks = {
  passwordChangedAt: Date | null;
  sessionInvalidBefore: Date | null;
};

export function isSessionStillValid(
  issuedAtMs: number,
  marks: SessionRevocationMarks,
  leewayMs: number = SESSION_LEEWAY_MS,
): boolean {
  if (
    marks.passwordChangedAt &&
    issuedAtMs < marks.passwordChangedAt.getTime() - leewayMs
  ) {
    return false;
  }
  if (
    marks.sessionInvalidBefore &&
    issuedAtMs < marks.sessionInvalidBefore.getTime() - leewayMs
  ) {
    return false;
  }
  return true;
}
