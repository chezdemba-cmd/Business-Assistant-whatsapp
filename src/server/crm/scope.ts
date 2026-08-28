import type { Prisma, Role } from "@prisma/client";

/**
 * Périmètre de visibilité CRM — PUR (testable sans DB).
 *
 * `organizationId` seul ne suffit pas : un SALES (et un EMPLOYEE) ne voient
 * que leurs clients assignés et leurs commandes. OWNER / ADMIN / MANAGER
 * voient toute l'organisation.
 */

const BROAD_ROLES: readonly Role[] = ["OWNER", "ADMIN", "MANAGER"];

export function canSeeAllCrm(role: Role): boolean {
  return BROAD_ROLES.includes(role);
}

/** Fragment `where` à combiner avec `{ organizationId }` pour les clients. */
export function customerScopeWhere(
  role: Role,
  userId: string,
): Prisma.CustomerWhereInput {
  return canSeeAllCrm(role) ? {} : { assignedToUserId: userId };
}

/**
 * Fragment `where` pour les commandes : un SALES/EMPLOYEE voit les commandes
 * qu'il a créées OU celles de clients qui lui sont assignés.
 */
export function orderScopeWhere(
  role: Role,
  userId: string,
): Prisma.OrderWhereInput {
  if (canSeeAllCrm(role)) return {};
  return {
    OR: [
      { createdByUserId: userId },
      { customer: { assignedToUserId: userId } },
    ],
  };
}

/** Un SALES/EMPLOYEE peut-il agir (transition, édition) sur cette commande ? */
export function canActOnOrder(
  role: Role,
  userId: string,
  order: { createdByUserId: string | null; customer: { assignedToUserId: string | null } },
): boolean {
  if (canSeeAllCrm(role)) return true;
  return (
    order.createdByUserId === userId ||
    order.customer.assignedToUserId === userId
  );
}

/** Un SALES/EMPLOYEE peut-il voir / agir sur ce client ? */
export function canAccessCustomer(
  role: Role,
  userId: string,
  customer: { assignedToUserId: string | null },
): boolean {
  if (canSeeAllCrm(role)) return true;
  return customer.assignedToUserId === userId;
}
