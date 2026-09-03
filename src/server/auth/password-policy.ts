/**
 * Politique de mot de passe — fonction PURE (aucune dépendance, testable,
 * utilisable côté client comme serveur). Longueur minimale + rejet des mots de
 * passe manifestement faibles (liste hors-ligne, pas d'appel réseau).
 *
 * Complète les autres contrôles ajoutés à l'audit : verrou de compte,
 * rate-limit par IP, bcrypt (12 rounds).
 */

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

/** Les plus courants / évidents (FR + EN + spécifiques produit). */
const COMMON = new Set([
  "password",
  "motdepasse",
  "12345678",
  "123456789",
  "1234567890",
  "azertyuiop",
  "qwertyuiop",
  "azerty123",
  "qwerty123",
  "password1",
  "password123",
  "motdepasse1",
  "0000000000",
  "1111111111",
  "iloveyou1",
  "admin1234",
  "welcome123",
  "changemenow",
  "letmein123",
  "feredron",
  "feredron123",
]);

/** `null` si le mot de passe est acceptable, sinon un message d'erreur. */
export function passwordIssue(input: string): string | null {
  const v = input.trim();
  if (v.length < MIN_PASSWORD_LENGTH) {
    return `${MIN_PASSWORD_LENGTH} caractères minimum`;
  }
  if (v.length > MAX_PASSWORD_LENGTH) {
    return "Mot de passe trop long";
  }
  const low = v.toLowerCase();
  if (COMMON.has(low)) {
    return "Ce mot de passe est trop courant — choisissez-en un autre";
  }
  if (/^(.)\1+$/.test(v)) {
    return "Évitez un seul caractère répété";
  }
  if (/^(0123456789|1234567890|abcdefghij|azertyuiop|qwertyuiop)/.test(low)) {
    return "Évitez une suite de touches évidente";
  }
  return null;
}
