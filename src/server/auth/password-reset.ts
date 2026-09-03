import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/server/db/client";
import { getEnv } from "@/lib/env";
import { Conflict } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import { hashPassword } from "./password";
import { getEmailProvider } from "@/server/email/provider";
import { buildPasswordResetEmail } from "@/server/email/templates";

/** SHA-256 hex du jeton — c'est CE hash qui est stocké, jamais le jeton en clair. */
export function hashResetToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

function resetUrl(token: string): string {
  const base = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${base}/reset-password/${token}`;
}

/**
 * Demande de réinitialisation. **Ne révèle jamais** si l'e-mail correspond à un
 * compte : renvoie toujours un succès. Si le compte existe, invalide les jetons
 * précédents non utilisés, en crée un nouveau et envoie l'e-mail.
 */
export async function requestPasswordReset(input: {
  email: string;
  requestIp?: string | null;
}): Promise<{ requested: true }> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, email: true, status: true },
  });

  if (user && user.status !== "DISABLED") {
    const ttlMin = getEnv().PASSWORD_RESET_TTL_MIN;
    const plain = randomBytes(32).toString("base64url");
    const tokenHash = hashResetToken(plain);

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }, // neutralise les anciens liens
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + ttlMin * 60_000),
          requestIp: input.requestIp ?? null,
        },
      }),
    ]);

    const mail = buildPasswordResetEmail({
      firstName: user.firstName,
      resetUrl: resetUrl(plain),
      ttlMinutes: ttlMin,
    });
    await getEmailProvider().send({ to: user.email, ...mail });

    await writeAuditLog({
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      metadata: { email },
    });
  }

  return { requested: true };
}

/**
 * Applique un nouveau mot de passe à partir d'un jeton. Le jeton doit être non
 * utilisé et non expiré. Réinitialise le verrou de compte et révoque toutes les
 * sessions (via `passwordChangedAt`).
 */
export async function resetPassword(input: {
  token: string;
  newPassword: string;
}): Promise<{ userId: string }> {
  const tokenHash = hashResetToken(input.token.trim());
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    throw Conflict(
      "Ce lien de réinitialisation est invalide ou expiré. Demandez-en un nouveau.",
    );
  }

  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        passwordChangedAt: now, // révoque toutes les sessions existantes
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: now } }),
    // Neutralise tout autre jeton en attente pour ce compte.
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: now },
    }),
  ]);

  await writeAuditLog({
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "user",
    entityId: row.userId,
    actorUserId: row.userId,
  });

  return { userId: row.userId };
}
