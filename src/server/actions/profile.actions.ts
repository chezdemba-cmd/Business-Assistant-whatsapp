"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { requireUserOrThrow } from "@/server/auth/current-user";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { revokeAllSessions } from "@/server/auth/revocation";
import { writeAuditLog } from "@/server/audit/log";
import { AppError } from "@/server/errors";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "@/server/validation/schemas";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";

export async function updateProfileAction(
  _prev: ActionResult<{ saved: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const user = await requireUserOrThrow();
    const input = updateProfileSchema.parse(formToObject(formData));
    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        locale: input.locale,
      },
    });
    await writeAuditLog({
      action: "PROFILE_UPDATED",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
    });
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    return { saved: true as const };
  });
}

export async function changePasswordAction(
  _prev: ActionResult<{ saved: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const user = await requireUserOrThrow();
    const input = changePasswordSchema.parse(formToObject(formData));

    const ok = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppError("VALIDATION", "Mot de passe actuel incorrect.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        // Invalide toutes les sessions existantes (cf. getCurrentUser).
        passwordChangedAt: new Date(),
      },
    });
    // Ré-émet une session fraîche pour l'appareil courant.
    await createSession(user.id);

    await writeAuditLog({
      action: "PASSWORD_CHANGED",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
    });
    return { saved: true as const };
  });
}

/**
 * Déconnecte TOUS les appareils (§5). Invalide les sessions existantes puis
 * ré-émet une session fraîche pour l'appareil courant.
 */
export async function revokeAllSessionsAction(
  _prev: ActionResult<{ done: true }> | null,
): Promise<ActionResult<{ done: true }>> {
  return runAction(async () => {
    const user = await requireUserOrThrow();
    await revokeAllSessions(user.id, { actorUserId: user.id, reason: "user_request" });
    await createSession(user.id);
    revalidatePath("/profile");
    return { done: true as const };
  });
}
