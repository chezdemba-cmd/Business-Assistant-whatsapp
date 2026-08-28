import type { Prisma, Role } from "@prisma/client";
import { canSeeAllCrm } from "../crm/scope.ts";

/**
 * Périmètre des recommandations — PUR (§41, §42, §66).
 * OWNER / ADMIN / MANAGER : toute l'organisation.
 * SALES / EMPLOYEE : uniquement les recommandations dont `ownerUserId` est
 * l'utilisateur (créance d'un client assigné, commande créée par lui…).
 */
export function recommendationScopeWhere(
  role: Role,
  userId: string,
): Prisma.BusinessRecommendationWhereInput {
  return canSeeAllCrm(role) ? {} : { ownerUserId: userId };
}

/** true si l'utilisateur peut voir une recommandation donnée. */
export function canSeeRecommendation(
  role: Role,
  userId: string,
  rec: { ownerUserId: string | null },
): boolean {
  return canSeeAllCrm(role) || rec.ownerUserId === userId;
}
