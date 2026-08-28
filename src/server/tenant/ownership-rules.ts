import type { Role } from "@prisma/client";

/**
 * Règles de PROPRIÉTÉ — prédicats PURS (aucune dépendance runtime, testables
 * sans base de données). Les gardes qui *jettent* vivent dans `ownership.ts`.
 *
 * Invariant : au plus **un OWNER actif** par organisation. Le propriétaire
 * initial est créé à la création de l'organisation et ne peut ensuite être
 * ni recréé, ni promu, ni rétrogradé, ni suspendu, ni retiré via les écrans
 * standard — seul un transfert de propriété explicite (hors MVP) le permettra.
 */

export const OWNER_ROLE = "OWNER" as const;

/** Rôles attribuables via invitation / changement de rôle — jamais OWNER. */
export const ASSIGNABLE_ROLES = [
  "ADMIN",
  "MANAGER",
  "SALES",
  "EMPLOYEE",
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isOwnerRole(role: Role): boolean {
  return role === OWNER_ROLE;
}

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/** Peut-on attribuer ce rôle via un écran standard ? (jamais OWNER) */
export function canAssignRole(role: Role): boolean {
  return !isOwnerRole(role);
}

/** Ce membre est-il protégé contre rétrogradation / suppression / suspension ? */
export function isOwnerProtected(targetRole: Role): boolean {
  return isOwnerRole(targetRole);
}

/** L'invariant « au plus un OWNER actif » est-il violé ? */
export function violatesSingleOwner(activeOwnerCount: number): boolean {
  return activeOwnerCount > 1;
}
