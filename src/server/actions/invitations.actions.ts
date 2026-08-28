"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { getEnv } from "@/lib/env";
import { actionOrgContext } from "./context";
import { getCurrentUser } from "@/server/auth/current-user";
import { createSession } from "@/server/auth/session";
import { setActiveOrganization } from "@/server/tenant/context";
import { hashPassword } from "@/server/auth/password";
import {
  assertRoleAssignable,
  assertSingleOwner,
} from "@/server/tenant/ownership";
import { writeAuditLog } from "@/server/audit/log";
import {
  AppError,
  Conflict,
  Forbidden,
  InvitationExpired,
  InvitationInvalid,
} from "@/server/errors";
import {
  createInvitationSchema,
  invitationIdSchema,
  acceptInvitationSchema,
} from "@/server/validation/schemas";
import { normalizePhone } from "@/lib/identifiers";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";

const INVITE_TTL_DAYS = 7;

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function inviteUrl(token: string): string {
  return `${getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/invite/${token}`;
}

export async function createInvitationAction(
  _prev: ActionResult<{ inviteUrl: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ inviteUrl: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "members.invite",
      organizationId: raw.organizationId,
    });
    const input = createInvitationSchema.parse(raw);
    assertRoleAssignable(input.role, "invitation");
    const phone = normalizePhone(
      input.phone,
      input.countryCode || ctx.organization.countryCode,
    );

    // Déjà membre ? (via un compte dont le téléphone correspond)
    const existingMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId: ctx.organization.id,
        user: { phone },
      },
      select: { id: true },
    });
    if (existingMember) {
      throw Conflict("Cette personne est déjà membre de l'entreprise.");
    }

    // Révoque toute invitation en attente pour ce numéro dans cette organisation.
    await prisma.invitation.updateMany({
      where: {
        organizationId: ctx.organization.id,
        phone,
        status: "PENDING",
      },
      data: { status: "REVOKED" },
    });

    const token = newToken();
    const invitation = await prisma.invitation.create({
      data: {
        organizationId: ctx.organization.id,
        phone,
        email: input.email ?? null,
        role: input.role,
        token,
        status: "PENDING",
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
        invitedByUserId: ctx.user.id,
      },
    });

    await writeAuditLog({
      action: "MEMBER_INVITED",
      entityType: "invitation",
      entityId: invitation.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { phone, role: input.role },
    });

    revalidatePath("/members");
    // NOTE Phase 1 : pas d'envoi WhatsApp — on renvoie le lien à partager.
    return { inviteUrl: inviteUrl(token) };
  });
}

export async function revokeInvitationAction(
  _prev: ActionResult<{ revoked: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ revoked: true }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "members.invite",
      organizationId: raw.organizationId,
    });
    const input = invitationIdSchema.parse(raw);

    const invitation = await prisma.invitation.findUnique({
      where: { id: input.invitationId },
    });
    if (!invitation || invitation.organizationId !== ctx.organization.id) {
      throw InvitationInvalid("Invitation introuvable.");
    }
    if (invitation.status === "PENDING") {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "REVOKED" },
      });
      await writeAuditLog({
        action: "MEMBER_INVITE_REVOKED",
        entityType: "invitation",
        entityId: invitation.id,
        organizationId: ctx.organization.id,
        actorUserId: ctx.user.id,
      });
    }

    revalidatePath("/members");
    return { revoked: true as const };
  });
}

/**
 * Acceptation d'invitation. Deux cas :
 *  - utilisateur connecté  -> rattachement direct
 *  - visiteur              -> création de compte (firstName/lastName/password requis)
 */
export async function acceptInvitationAction(
  _prev: ActionResult<{ redirectTo: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const input = acceptInvitationSchema.parse(raw);

    const invitation = await prisma.invitation.findUnique({
      where: { token: input.token },
      include: { organization: true },
    });
    if (!invitation || invitation.status !== "PENDING") {
      throw InvitationInvalid();
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw InvitationExpired();
    }
    if (invitation.organization.status !== "ACTIVE") {
      throw Forbidden("Cette entreprise n'est pas disponible.");
    }
    // Une invitation ne peut jamais conférer le rôle OWNER.
    assertRoleAssignable(invitation.role, "acceptation d'invitation");

    let user = await getCurrentUser();
    let createdNewUser = false;

    if (!user) {
      if (!input.firstName || !input.lastName || !input.password) {
        throw new AppError(
          "VALIDATION",
          "Renseignez votre nom, prénom et mot de passe pour rejoindre l'entreprise.",
        );
      }
      const email =
        invitation.email ??
        `${invitation.phone.replace(/[^0-9]/g, "")}@invite.djeli.local`;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw Conflict(
          "Un compte existe déjà. Connectez-vous puis rouvrez le lien d'invitation.",
        );
      }
      user = await prisma.user.create({
        data: {
          email,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: invitation.phone,
          passwordHash: await hashPassword(input.password),
        },
      });
      createdNewUser = true;
    }

    const joinedUserId = user.id;
    await prisma.$transaction(async (tx) => {
      // Déjà membre ? -> on solde juste l'invitation.
      const already = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: joinedUserId,
          },
        },
      });

      if (!already) {
        await tx.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: joinedUserId,
            role: invitation.role,
            status: "ACTIVE",
            invitedByUserId: invitation.invitedByUserId,
          },
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedByUserId: joinedUserId,
          acceptedAt: new Date(),
        },
      });

      // Invariant : l'acceptation ne doit jamais créer un 2ᵉ OWNER.
      await assertSingleOwner(tx, invitation.organizationId);
    });

    if (createdNewUser) await createSession(user.id);
    await setActiveOrganization(invitation.organizationId);

    await writeAuditLog({
      action: "MEMBER_JOINED",
      entityType: "organization_member",
      organizationId: invitation.organizationId,
      actorUserId: user.id,
      metadata: { role: invitation.role, via: "invitation", invitationId: invitation.id },
    });

    return { redirectTo: "/dashboard" };
  });
}
