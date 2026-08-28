"use server";

import { revalidatePath } from "next/cache";
import type { OrganizationMember } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { actionOrgContext } from "./context";
import { writeAuditLog } from "@/server/audit/log";
import { Forbidden, NotFound } from "@/server/errors";
import {
  assertOwnerProtected,
  assertRoleAssignable,
} from "@/server/tenant/ownership";
import {
  updateMemberRoleSchema,
  membershipIdSchema,
} from "@/server/validation/schemas";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";
import type { Permission } from "@/server/rbac/permissions";

/**
 * Charge le membre cible et garantit qu'il appartient bien à l'organisation
 * du contexte (barrière multi-tenant). Renvoie 404 sinon — on ne divulgue
 * pas l'existence d'un membre d'une autre entreprise.
 */
async function loadTargetMember(
  membershipId: string,
  organizationId: string,
): Promise<OrganizationMember> {
  const target = await prisma.organizationMember.findUnique({
    where: { id: membershipId },
  });
  if (!target || target.organizationId !== organizationId) {
    throw NotFound("Membre introuvable dans cette entreprise.");
  }
  return target;
}

/** Empêche un membre d'agir sur son propre accès via l'écran standard. */
function assertNotSelf(
  target: OrganizationMember,
  actorUserId: string,
  actionLabel: string,
): void {
  if (target.userId === actorUserId) {
    throw Forbidden(`Vous ne pouvez pas ${actionLabel} votre propre accès.`);
  }
}

export async function updateMemberRoleAction(
  _prev: ActionResult<{ updated: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ updated: true }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "members.update",
      organizationId: raw.organizationId,
    });
    const input = updateMemberRoleSchema.parse(raw);
    assertRoleAssignable(input.role, "changement de rôle");
    const target = await loadTargetMember(input.membershipId, ctx.organization.id);
    assertOwnerProtected(target.role, "role-change");
    assertNotSelf(target, ctx.user.id, "modifier le rôle de");

    if (target.role === input.role) return { updated: true as const };

    await prisma.organizationMember.update({
      where: { id: target.id },
      data: { role: input.role },
    });

    await writeAuditLog({
      action: "MEMBER_ROLE_CHANGED",
      entityType: "organization_member",
      entityId: target.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { from: target.role, to: input.role, memberUserId: target.userId },
    });

    revalidatePath("/members");
    return { updated: true as const };
  });
}

export async function removeMemberAction(
  _prev: ActionResult<{ removed: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ removed: true }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "members.remove",
      organizationId: raw.organizationId,
    });
    const input = membershipIdSchema.parse(raw);
    const target = await loadTargetMember(input.membershipId, ctx.organization.id);
    assertOwnerProtected(target.role, "remove");
    assertNotSelf(target, ctx.user.id, "retirer");

    await prisma.organizationMember.delete({ where: { id: target.id } });

    await writeAuditLog({
      action: "MEMBER_REMOVED",
      entityType: "organization_member",
      entityId: target.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { memberUserId: target.userId, role: target.role },
    });

    revalidatePath("/members");
    return { removed: true as const };
  });
}

async function setMemberStatus(
  formData: FormData,
  next: "ACTIVE" | "SUSPENDED",
  permission: Permission,
  auditAction: "MEMBER_SUSPENDED" | "MEMBER_REACTIVATED",
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission,
      organizationId: raw.organizationId,
    });
    const input = membershipIdSchema.parse(raw);
    const target = await loadTargetMember(input.membershipId, ctx.organization.id);
    assertOwnerProtected(target.role, "suspend");
    assertNotSelf(
      target,
      ctx.user.id,
      next === "SUSPENDED" ? "suspendre" : "réactiver",
    );

    await prisma.organizationMember.update({
      where: { id: target.id },
      data: { status: next },
    });
    await writeAuditLog({
      action: auditAction,
      entityType: "organization_member",
      entityId: target.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { memberUserId: target.userId },
    });
    revalidatePath("/members");
    return { ok: true as const };
  });
}

export async function suspendMemberAction(
  _prev: ActionResult<{ ok: true }> | null,
  formData: FormData,
) {
  return setMemberStatus(
    formData,
    "SUSPENDED",
    "members.update",
    "MEMBER_SUSPENDED",
  );
}

export async function reactivateMemberAction(
  _prev: ActionResult<{ ok: true }> | null,
  formData: FormData,
) {
  return setMemberStatus(
    formData,
    "ACTIVE",
    "members.update",
    "MEMBER_REACTIVATED",
  );
}
