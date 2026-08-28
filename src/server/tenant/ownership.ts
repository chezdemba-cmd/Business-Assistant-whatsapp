import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { Conflict, Forbidden } from "@/server/errors";
import {
  canAssignRole,
  isOwnerProtected,
  violatesSingleOwner,
  type AssignableRole,
} from "./ownership-rules";

export {
  OWNER_ROLE,
  ASSIGNABLE_ROLES,
  isAssignableRole,
  canAssignRole,
  isOwnerProtected,
  violatesSingleOwner,
} from "./ownership-rules";
export type { AssignableRole } from "./ownership-rules";

/**
 * Garde : refuse d'attribuer le rôle OWNER hors création d'organisation.
 * À appeler à l'invitation, à l'acceptation ET au changement de rôle.
 */
export function assertRoleAssignable(
  role: Role,
  context: "invitation" | "changement de rôle" | "acceptation d'invitation",
): asserts role is AssignableRole {
  if (!canAssignRole(role)) {
    throw Forbidden(
      `Le rôle propriétaire ne peut pas être attribué via ${context}. ` +
        "Il nécessite un transfert de propriété explicite.",
    );
  }
}

const ACTION_LABEL: Record<"role-change" | "remove" | "suspend", string> = {
  "role-change": "voir son rôle modifié",
  remove: "être retiré",
  suspend: "être suspendu",
};

/**
 * Garde : protège le propriétaire principal contre toute mutation
 * (rétrogradation, suppression, suspension).
 */
export function assertOwnerProtected(
  targetRole: Role,
  action: "role-change" | "remove" | "suspend",
): void {
  if (isOwnerProtected(targetRole)) {
    throw Forbidden(
      `Le propriétaire de l'entreprise ne peut pas ${ACTION_LABEL[action]} ` +
        "directement. Effectuez d'abord un transfert de propriété.",
    );
  }
}

type OwnerCounter =
  | Pick<PrismaClient, "organizationMember">
  | Prisma.TransactionClient;

/**
 * Post-condition : vérifie qu'une organisation n'a pas plus d'un OWNER actif.
 * À appeler dans la MÊME transaction que toute écriture susceptible d'en
 * créer un (création d'organisation, acceptation d'invitation).
 */
export async function assertSingleOwner(
  client: OwnerCounter,
  organizationId: string,
): Promise<void> {
  const owners = await client.organizationMember.count({
    where: {
      organizationId,
      role: "OWNER",
      status: { not: "SUSPENDED" },
    },
  });
  if (violatesSingleOwner(owners)) {
    throw Conflict("Cette organisation a déjà un propriétaire.");
  }
}
