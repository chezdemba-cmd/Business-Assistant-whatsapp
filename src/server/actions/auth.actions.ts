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
import { normalizePhone } from "@/lib/identifiers";
import {
  issuePasswordResetToken,
  verifyPasswordResetToken,
  resetTokenMatchesAccount,
} from "@/server/auth/password-reset";
import { getEmailProvider } from "@/server/email/provider";
import { logError } from "@/server/errors";
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
      getEnv().LOGIN_RATE_LIMIT_PER_MIN,
      60_000,
    );
    if (!rl.allowed) {
      throw RateLimited("Trop de tentatives d'inscription. Réessayez dans une minute.");
    }

    const input = registerSchema.parse(formToObject(formData));

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw Conflict("Un compte existe déjà avec cet email.");
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

    const passwordOk =
      user && (await verifyPassword(input.password, user.passwordHash));

    if (!user || !passwordOk) {
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
      data: { lastLoginAt: new Date() },
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

// ── Mot de passe oublié ───────────────────────────────────────────────

type Sent = { sent: true };

/**
 * Demande de réinitialisation. Réponse TOUJOURS identique (pas d'énumération de
 * comptes). Rate-limité par IP. L'e-mail part via le provider configuré
 * (`log` par défaut : le lien est journalisé, pas envoyé).
 */
export async function requestPasswordResetAction(
  _prev: FormState<Sent>,
  formData: FormData,
): Promise<ActionResult<Sent>> {
  return runAction(async () => {
    const ip = await callerIp();
    const rl = await consumeRateLimit(
      `pwreset:${ip}`,
      getEnv().LOGIN_RATE_LIMIT_PER_MIN,
      60_000,
    );
    if (!rl.allowed) {
      throw RateLimited("Trop de demandes. Réessayez dans une minute.");
    }

    const { email } = requestPasswordResetSchema.parse(formToObject(formData));
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.status === "ACTIVE" && user.passwordHash) {
      try {
        const token = await issuePasswordResetToken(user.id, user.passwordChangedAt);
        const url = `${getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
        await getEmailProvider().send({
          to: email,
          subject: "Réinitialisation de votre mot de passe Djeli",
          text:
            `Bonjour,\n\nVous avez demandé à réinitialiser votre mot de passe Djeli.\n` +
            `Ouvrez ce lien (valable 1 heure) :\n\n${url}\n\n` +
            `Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : ` +
            `votre mot de passe reste inchangé.`,
        });
        await writeAuditLog({
          action: "PASSWORD_RESET_REQUESTED",
          entityType: "user",
          entityId: user.id,
          actorUserId: user.id,
        });
      } catch (e) {
        // L'échec d'envoi ne doit pas révéler l'existence du compte.
        logError("auth.passwordReset.request", e, { email });
      }
    }

    return { sent: true as const };
  });
}

/**
 * Application du nouveau mot de passe. Vérifie le token (signature + expiration
 * + usage unique via `passwordChangedAt`), met à jour le hash, invalide toutes
 * les sessions antérieures et ouvre une session fraîche.
 */
export async function resetPasswordAction(
  _prev: FormState<Redirect>,
  formData: FormData,
): Promise<ActionResult<Redirect>> {
  return runAction(async () => {
    const input = resetPasswordSchema.parse(formToObject(formData));

    const claims = await verifyPasswordResetToken(input.token);
    if (!claims) {
      throw new AppError(
        "VALIDATION",
        "Ce lien de réinitialisation est invalide ou expiré. Refaites une demande.",
      );
    }

    const user = await prisma.user.findUnique({ where: { id: claims.userId } });
    if (!user || user.status !== "ACTIVE") {
      throw new AppError("VALIDATION", "Ce lien n'est plus valable.");
    }
    if (!resetTokenMatchesAccount(claims, user.passwordChangedAt)) {
      throw new AppError(
        "VALIDATION",
        "Ce lien a déjà été utilisé ou le mot de passe a changé depuis. Refaites une demande.",
      );
    }

    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.password),
        passwordChangedAt: now,
        // Révocation dure : toute session existante est rejetée.
        sessionInvalidBefore: now,
      },
    });
    await writeAuditLog({
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
    });

    await createSession(user.id);
    const membershipCount = await prisma.organizationMember.count({
      where: { userId: user.id, status: { not: "SUSPENDED" } },
    });
    return { redirectTo: membershipCount > 0 ? "/dashboard" : "/onboarding" };
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
