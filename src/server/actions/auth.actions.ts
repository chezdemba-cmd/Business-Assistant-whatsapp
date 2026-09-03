"use server";

import { headers } from "next/headers";
import { prisma } from "@/server/db/client";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { getCurrentUser } from "@/server/auth/current-user";
import { writeAuditLog } from "@/server/audit/log";
import { AppError, Conflict, RateLimited } from "@/server/errors";
import { getEnv } from "@/lib/env";
import { consumeRateLimit } from "@/server/ratelimit/store";
import {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/server/validation/schemas";
import {
  isAccountLocked,
  registerFailedAttempt,
  clearedAttemptState,
  needsClearing,
} from "@/server/auth/lockout";
import { requestPasswordReset, resetPassword } from "@/server/auth/password-reset";
import { normalizePhone } from "@/lib/identifiers";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";

/** IP appelante (best-effort, derrière un proxy de confiance). */
async function callerIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]?.trim() : null) || h.get("x-real-ip") || "unknown";
}

type Redirect = { redirectTo: string };
type FormState<T> = ActionResult<T> | null;

export async function registerAction(
  _prev: FormState<Redirect>,
  formData: FormData,
): Promise<ActionResult<Redirect>> {
  return runAction(async () => {
    const ip = await callerIp();
    const rl = await consumeRateLimit(
      `register:${ip}`,
      getEnv().REGISTER_RATE_LIMIT_PER_MIN,
      60_000,
    );
    if (!rl.allowed) {
      throw RateLimited("Trop de tentatives. Réessayez dans une minute.");
    }

    const input = registerSchema.parse(formToObject(formData));

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      // Message volontairement non affirmatif : ne confirme pas frontalement
      // l'existence du compte. La non-énumération complète (réponse identique
      // + notification e-mail) attend le système d'e-mail (cf. reset mot de passe).
      throw Conflict(
        "Impossible de créer un compte avec cet e-mail. S'il vous appartient déjà, connectez-vous.",
      );
    }

    const user = await prisma.user.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ? normalizePhone(input.phone) : null,
        passwordHash: await hashPassword(input.password),
      },
    });

    await createSession(user.id);
    await writeAuditLog({
      action: "USER_REGISTERED",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
    });

    return { redirectTo: "/onboarding" };
  });
}

export async function loginAction(
  _prev: FormState<Redirect>,
  formData: FormData,
): Promise<ActionResult<Redirect>> {
  return runAction(async () => {
    const ip = await callerIp();
    const rl = await consumeRateLimit(
      `login:${ip}`,
      getEnv().LOGIN_RATE_LIMIT_PER_MIN,
      60_000,
    );
    if (!rl.allowed) {
      throw RateLimited("Trop de tentatives de connexion. Réessayez dans une minute.");
    }

    const input = loginSchema.parse(formToObject(formData));

    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    // Verrouillage PAR COMPTE (anti-brute-force, complète le rate-limit par IP).
    if (user && isAccountLocked(user)) {
      await writeAuditLog({
        action: "LOGIN_BLOCKED_LOCKED",
        entityType: "user",
        entityId: user.id,
        metadata: { email: input.email },
      });
      throw new AppError(
        "RATE_LIMITED",
        "Compte temporairement bloqué après trop de tentatives. Réessayez plus tard.",
      );
    }

    const passwordOk =
      user && (await verifyPassword(input.password, user.passwordHash));

    if (!user || !passwordOk) {
      if (user) {
        const next = registerFailedAttempt(user);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: next.failedLoginCount,
            lockedUntil: next.lockedUntil,
          },
        });
        if (next.justLocked) {
          await writeAuditLog({
            action: "LOGIN_LOCKED",
            entityType: "user",
            entityId: user.id,
            metadata: { email: input.email },
          });
        }
      }
      await writeAuditLog({
        action: "LOGIN_FAILED",
        entityType: "user",
        entityId: user?.id ?? null,
        metadata: { email: input.email },
      });
      throw new AppError(
        "UNAUTHENTICATED",
        "Email ou mot de passe incorrect.",
      );
    }
    if (user.status === "DISABLED") {
      throw new AppError("FORBIDDEN", "Ce compte est désactivé.");
    }

    await createSession(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        // Réinitialise le compteur d'échecs / le verrou au succès.
        ...(needsClearing(user) ? clearedAttemptState() : {}),
      },
    });
    await writeAuditLog({
      action: "LOGIN_SUCCESS",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
    });

    const membershipCount = await prisma.organizationMember.count({
      where: { userId: user.id, status: { not: "SUSPENDED" } },
    });

    return { redirectTo: membershipCount > 0 ? "/dashboard" : "/onboarding" };
  });
}

/**
 * Demande de réinitialisation. Réponse TOUJOURS identique (anti-énumération) :
 * l'utilisateur ne sait pas si l'e-mail correspond à un compte.
 */
export async function requestPasswordResetAction(
  _prev: FormState<{ sent: true }>,
  formData: FormData,
): Promise<ActionResult<{ sent: true }>> {
  return runAction(async () => {
    const ip = await callerIp();
    const rl = await consumeRateLimit(
      `pwreset:${ip}`,
      getEnv().PASSWORD_RESET_RATE_LIMIT_PER_MIN,
      60_000,
    );
    if (!rl.allowed) {
      throw RateLimited("Trop de demandes. Réessayez dans une minute.");
    }
    const input = requestPasswordResetSchema.parse(formToObject(formData));
    await requestPasswordReset({ email: input.email, requestIp: ip });
    return { sent: true as const };
  });
}

/** Applique un nouveau mot de passe à partir d'un jeton reçu par e-mail. */
export async function resetPasswordAction(
  _prev: FormState<Redirect>,
  formData: FormData,
): Promise<ActionResult<Redirect>> {
  return runAction(async () => {
    const input = resetPasswordSchema.parse(formToObject(formData));
    await resetPassword({ token: input.token, newPassword: input.newPassword });
    return { redirectTo: "/login?reset=1" };
  });
}

export async function logoutAction(): Promise<ActionResult<Redirect>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (user) {
      await writeAuditLog({
        action: "LOGOUT",
        entityType: "user",
        entityId: user.id,
        actorUserId: user.id,
      });
    }
    await destroySession();
    return { redirectTo: "/login" };
  });
}
