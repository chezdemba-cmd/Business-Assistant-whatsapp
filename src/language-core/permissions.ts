/**
 * Permissions de la Language API — PUR. Volontairement des chaînes (extensible
 * par de futures applications) et non un enum RBAC du Business Assistant.
 */

export const LANGUAGE_PERMISSIONS = [
  "language.read",
  "language.write",
  "language.validate",
  "language.export",
  "language.organization.read",
  "language.organization.write",
  // Phase 6D — revue des candidats Learning Loop (jamais accordé par défaut à
  // une application métier — §46).
  "language.review",
] as const;

export type LanguagePermission = (typeof LANGUAGE_PERMISSIONS)[number];

export function isLanguagePermission(v: string): v is LanguagePermission {
  return (LANGUAGE_PERMISSIONS as readonly string[]).includes(v);
}

export function clientCan(
  granted: readonly string[],
  needed: LanguagePermission,
): boolean {
  return granted.includes(needed);
}

/** Le connecteur interne du Business Assistant : lecture + soumission, jamais validate. */
export const BUSINESS_CONNECTOR_PERMISSIONS: LanguagePermission[] = [
  "language.read",
  "language.write",
  "language.organization.read",
  "language.organization.write",
];
