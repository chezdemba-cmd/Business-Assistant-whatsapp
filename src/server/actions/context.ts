import "server-only";
import type { OrgContext } from "@/server/tenant/context";
import {
  getOrgContext,
  requireOrganizationAccess,
} from "@/server/tenant/context";
import { requireUserOrThrow } from "@/server/auth/current-user";
import { requirePermission } from "@/server/rbac/guard";
import type { Permission } from "@/server/rbac/permissions";
import { Forbidden } from "@/server/errors";

/**
 * Contexte d'organisation pour une Server Action + contrôle de permission.
 *
 * `organizationId` peut provenir du client — il est SYSTÉMATIQUEMENT re-validé
 * ici contre l'appartenance réelle de l'utilisateur (barrière multi-tenant).
 */
export async function actionOrgContext(opts: {
  permission: Permission;
  organizationId?: string | null;
}): Promise<OrgContext> {
  const user = await requireUserOrThrow();

  const ctx: OrgContext | null = opts.organizationId
    ? await requireOrganizationAccess(user.id, opts.organizationId)
    : await getOrgContext(user);

  if (!ctx) throw Forbidden("Aucune organisation active.");

  requirePermission(ctx.role, opts.permission);
  return ctx;
}
