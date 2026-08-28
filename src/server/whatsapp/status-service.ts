import "server-only";
import { prisma } from "@/server/db/client";
import { mergeMessageStatus } from "./message-status";
import type { ParsedStatusUpdate } from "./webhook-parser";

/**
 * Applique un webhook de statut (`sent` / `delivered` / `read` / `failed`) à un
 * message sortant. Ne régresse jamais (`READ` reçu après, puis `SENT` → reste
 * `READ`). Idempotent.
 */
export async function applyStatusUpdate(
  organizationId: string,
  update: ParsedStatusUpdate,
): Promise<{ applied: boolean }> {
  const message = await prisma.message.findFirst({
    where: { organizationId, externalMessageId: update.externalMessageId },
    select: { id: true, status: true },
  });
  if (!message) return { applied: false };

  const next = mergeMessageStatus(message.status, update.status);
  if (next === message.status && update.status !== "FAILED") {
    return { applied: false };
  }

  await prisma.message.update({
    where: { id: message.id },
    data: {
      status: next,
      ...(update.timestamp ? { providerTimestamp: update.timestamp } : {}),
      ...(next === "FAILED"
        ? {
            errorCode: update.errorCode,
            errorMessage: update.errorMessage?.slice(0, 500) ?? null,
          }
        : {}),
    },
  });
  return { applied: true };
}
