import "server-only";
import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/audit/log";

/**
 * Révocation de sessions (§5). Approche « sessionInvalidBefore » : toute
 * session émise AVANT cette date est rejetée par `getCurrentUser`. Pas de table
 * de sessions — suffisant pour : déconnexion globale, appareil compromis,
 * suspension de compte.
 */
export async function revokeAllSessions(
  userId: string,
  opts: { actorUserId?: string | null; reason?: string } = {},
): Promise<void> {
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { sessionInvalidBefore: now },
  });
  await writeAuditLog({
    action: "LOGOUT",
    entityType: "user",
    entityId: userId,
    actorUserId: opts.actorUserId ?? userId,
    metadata: { scope: "all_devices", reason: opts.reason ?? "user_request" },
  });
}
