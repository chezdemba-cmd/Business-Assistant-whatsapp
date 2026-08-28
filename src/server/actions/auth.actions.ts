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
import { registerSchema, loginSchema } from "@/server/validation/schemas";
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
