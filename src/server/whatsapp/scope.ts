import type { Prisma, Role } from "@prisma/client";
import { canSeeAllCrm } from "../crm/scope.ts";

/**
 * Périmètre de visibilité des conversations — PUR.
 *
 * OWNER / ADMIN / MANAGER : toutes les conversations de l'organisation.
 * SALES / EMPLOYEE : conversations qui leur sont assignées OU dont le client
 * leur est assigné (cohérent avec le périmètre CRM de la Phase 3).
 */

export function conversationScopeWhere(
  role: Role,
  userId: string,
): Prisma.ConversationWhereInput {
  if (canSeeAllCrm(role)) return {};
  return {
    OR: [
      { assignedToUserId: userId },
      { customer: { assignedToUserId: userId } },
    ],
  };
}

export function canAccessConversation(
  role: Role,
  userId: string,
  conversation: {
    assignedToUserId: string | null;
    customer: { assignedToUserId: string | null } | null;
  },
): boolean {
  if (canSeeAllCrm(role)) return true;
  return (
    conversation.assignedToUserId === userId ||
    conversation.customer?.assignedToUserId === userId
  );
}

/** Seuls OWNER / ADMIN / MANAGER assignent une conversation à un membre. */
export function canAssignConversations(role: Role): boolean {
  return canSeeAllCrm(role);
}
