import type { Role } from "@prisma/client";

/**
 * Couche RBAC centralisée. Aucune règle d'autorisation ne doit être
 * dispersée ailleurs sous forme de `if (role === "OWNER")`.
 *
 * Beaucoup de permissions ci-dessous ne seront réellement exploitées
 * qu'aux phases suivantes (catalogue, stock, commandes…), mais le
 * catalogue complet est figé dès maintenant pour éviter les migrations
 * de logique plus tard.
 */

export const PERMISSIONS = [
  "organization.read",
  "organization.update",
  "organization.delete",
  "members.read",
  "members.invite",
  "members.update",
  "members.remove",
  "settings.read",
  "settings.update",
  "catalog.read",
  "catalog.write",
  "customers.read",
  "customers.write",
  "orders.read",
  "orders.write",
  "stock.read",
  "stock.write",
  "debts.read",
  "debts.write",
  "conversations.read",
  "conversations.write",
  "ai.use",
  "billing.manage",
  "audit.read",
  // Phase 6C — administration interne du Djeli Language Core (l'API externe a sa
  // propre auth par ApplicationClient).
  "language.admin",
  // Phase 6D — revue des candidats du Learning Loop (approuver/rejeter/promouvoir).
  // `language.validate` reste la validation finale d'une entrée.
  "language.review",
  // Phase 7 — automatisations, recommandations, marketing.
  "recommendations.read",
  "automations.read",
  "automations.manage",
  "marketing.read",
  "marketing.manage",
  // Envoi effectif d'une campagne (validation finale). Distincte de
  // `marketing.manage` : préparer/approuver ≠ déclencher l'envoi (§24).
  "marketing.send",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Rang hiérarchique — utile pour « seul un rôle ≥ peut modifier ». */
export const ROLE_RANK: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  SALES: 2,
  EMPLOYEE: 1,
};

const READ_ALL_BUSINESS: Permission[] = [
  "catalog.read",
  "customers.read",
  "orders.read",
  "stock.read",
  "debts.read",
  "conversations.read",
];

const WRITE_ALL_BUSINESS: Permission[] = [
  "catalog.write",
  "customers.write",
  "orders.write",
  "stock.write",
  "debts.write",
  "conversations.write",
];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  "organization.read",
  "catalog.read",
  "customers.read",
  "orders.read",
  "conversations.read",
  // Voit les recommandations de son périmètre (scope appliqué en plus, §41).
  "recommendations.read",
];

const SALES_PERMISSIONS: Permission[] = [
  "organization.read",
  "members.read",
  "catalog.read",
  "customers.read",
  "customers.write",
  "orders.read",
  "orders.write",
  "conversations.read",
  "conversations.write",
  "debts.read",
  // SALES encaisse / relance dans son périmètre CRM (§31) ; le scope est
  // appliqué en plus de la permission par `canActOnOrder` / `canAccessCustomer`.
  "debts.write",
  "ai.use",
  // Recommandations de SON périmètre uniquement (clients/commandes assignés).
  "recommendations.read",
];

const MANAGER_PERMISSIONS: Permission[] = [
  "organization.read",
  "members.read",
  "settings.read",
  ...READ_ALL_BUSINESS,
  ...WRITE_ALL_BUSINESS,
  "ai.use",
  "audit.read",
  "recommendations.read",
  "automations.read",
  "automations.manage",
  "marketing.read",
  "marketing.manage",
];

const ADMIN_PERMISSIONS: Permission[] = [
  "organization.read",
  "organization.update",
  "members.read",
  "members.invite",
  "members.update",
  "members.remove",
  "settings.read",
  "settings.update",
  ...READ_ALL_BUSINESS,
  ...WRITE_ALL_BUSINESS,
  "ai.use",
  "audit.read",
  "language.admin",
  "language.review",
  "recommendations.read",
  "automations.read",
  "automations.manage",
  "marketing.read",
  "marketing.manage",
  "marketing.send",
];

// OWNER : tout.
const OWNER_PERMISSIONS: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set(OWNER_PERMISSIONS),
  ADMIN: new Set(ADMIN_PERMISSIONS),
  MANAGER: new Set(MANAGER_PERMISSIONS),
  SALES: new Set(SALES_PERMISSIONS),
  EMPLOYEE: new Set(EMPLOYEE_PERMISSIONS),
};

/** Vraie ou fausse — ne jette jamais. */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Au moins une des permissions. */
export function canAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/** Toutes les permissions. */
export function canAll(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Liste triée des permissions d'un rôle (pratique pour l'UI « ce que ce rôle peut faire »). */
export function permissionsOf(role: Role): Permission[] {
  return PERMISSIONS.filter((p) => ROLE_PERMISSIONS[role].has(p));
}
