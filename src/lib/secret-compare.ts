import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Comparaison de deux secrets à temps constant (anti-timing-attack).
 * `false` si l'un est absent. Les deux valeurs sont d'abord hachées à taille
 * fixe : la comparaison ne révèle pas non plus la longueur du secret attendu.
 *
 * Réservé aux contextes Node (routes `runtime = "nodejs"`, scripts).
 */
export function secretsMatch(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
