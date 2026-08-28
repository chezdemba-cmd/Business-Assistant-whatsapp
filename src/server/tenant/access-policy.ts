import type {
  MembershipStatus,
  OrganizationStatus,
  Role,
} from "@prisma/client";

/**
 * Politique d'accès multi-tenant — fonction PURE (aucune dépendance runtime,
 * testable sans base de données).
 *
 * `requireOrganizationAccess()` charge le `OrganizationMember` via la clé
 * unique (organizationId, userId) : un utilisateur de l'organisation A qui
 * cible l'organisation B obtient toujours `null` ici → `NOT_A_MEMBER`.
 */
export type MembershipLike = {
  status: MembershipStatus;
  role: Role;
  organization: { status: OrganizationStatus };
};

export type AccessDecision =
  | { ok: true; role: Role }
  | { ok: false; reason: "NOT_A_MEMBER" | "SUSPENDED" | "ORG_INACTIVE" };

export function evaluateOrganizationAccess(
  membership: MembershipLike | null | undefined,
): AccessDecision {
  if (!membership) return { ok: false, reason: "NOT_A_MEMBER" };
  if (membership.status === "SUSPENDED") {
    return { ok: false, reason: "SUSPENDED" };
  }
  if (membership.organization.status !== "ACTIVE") {
    return { ok: false, reason: "ORG_INACTIVE" };
  }
  return { ok: true, role: membership.role };
}
