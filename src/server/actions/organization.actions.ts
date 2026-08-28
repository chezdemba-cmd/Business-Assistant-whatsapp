"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { requireUserOrThrow } from "@/server/auth/current-user";
import { setActiveOrganization } from "@/server/tenant/context";
import { assertSingleOwner } from "@/server/tenant/ownership";
import { writeAuditLog } from "@/server/audit/log";
import { createOrganizationSchema } from "@/server/validation/schemas";
import { slugify, shortId } from "@/lib/identifiers";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";

type CreateResult = { organizationId: string; redirectTo: string };

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${shortId(4)}`;
    const clash = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${base}-${shortId(8)}`;
}

/**
 * Onboarding — étape 1 : création de l'entreprise.
 * L'utilisateur courant devient OWNER (membre + owner de l'organisation).
 */
export async function createOrganizationAction(
  _prev: ActionResult<CreateResult> | null,
  formData: FormData,
): Promise<ActionResult<CreateResult>> {
  return runAction(async () => {
    const user = await requireUserOrThrow();
    const input = createOrganizationSchema.parse(formToObject(formData));

    const slug = await uniqueSlug(input.name);

    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.name,
          slug,
          countryCode: input.countryCode,
          currency: input.currency,
          timezone: input.timezone,
          city: input.city ?? null,
          businessType: input.businessType,
          ownerUserId: user.id,
          onboardedAt: null,
        },
      });
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      // Invariant : exactement un OWNER à la création.
      await assertSingleOwner(tx, org.id);
      return org;
    });

    await setActiveOrganization(organization.id);

    await writeAuditLog({
      action: "ORGANIZATION_CREATED",
      entityType: "organization",
      entityId: organization.id,
      organizationId: organization.id,
      actorUserId: user.id,
      metadata: { name: organization.name, countryCode: organization.countryCode },
    });
    await writeAuditLog({
      action: "MEMBER_JOINED",
      entityType: "organization_member",
      organizationId: organization.id,
      actorUserId: user.id,
      metadata: { role: "OWNER", via: "onboarding" },
    });

    revalidatePath("/dashboard");
    return {
      organizationId: organization.id,
      redirectTo: "/onboarding/team",
    };
  });
}

/** Marque l'onboarding comme terminé (fin de l'étape équipe). */
export async function completeOnboardingAction(): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const user = await requireUserOrThrow();
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id, role: "OWNER" },
      orderBy: { joinedAt: "desc" },
    });
    if (membership) {
      await prisma.organization.updateMany({
        where: { id: membership.organizationId, onboardedAt: null },
        data: { onboardedAt: new Date() },
      });
    }
    revalidatePath("/dashboard");
    return { redirectTo: "/dashboard" };
  });
}
