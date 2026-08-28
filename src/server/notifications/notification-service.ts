import "server-only";
import type { NotificationType, Role } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { canSeeAllCrm } from "@/server/crm/scope";

/**
 * Centre de notifications interne (§39-42). MVP in-app. Le périmètre suit
 * l'existant : une notification adressée à `userId` n'est vue que par lui ; une
 * notification à `userId = null` est « organisation » et n'apparaît que pour les
 * rôles larges (OWNER / ADMIN / MANAGER).
 */

export type NotifyInput = {
  organizationId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** null = notification à l'échelle de l'organisation (rôles larges). */
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /** Anti-doublon : ne crée pas si une notif non lue de même (type, entityId) existe. */
  dedupe?: boolean;
};

export async function notify(input: NotifyInput): Promise<{ id: string; created: boolean }> {
  if (input.dedupe && input.entityId) {
    const existing = await prisma.notification.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        type: input.type,
        entityId: input.entityId,
        readAt: null,
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };
  }
  const n = await prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 1000),
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
    select: { id: true },
  });
  return { id: n.id, created: true };
}

export function notificationScopeWhere(role: Role, userId: string) {
  return canSeeAllCrm(role)
    ? { OR: [{ userId }, { userId: null }] }
    : { userId };
}

export async function listNotifications(
  organizationId: string,
  role: Role,
  userId: string,
  opts: { unreadOnly?: boolean; take?: number } = {},
) {
  return prisma.notification.findMany({
    where: {
      organizationId,
      ...notificationScopeWhere(role, userId),
      ...(opts.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 30,
  });
}

export async function countUnread(
  organizationId: string,
  role: Role,
  userId: string,
): Promise<number> {
  return prisma.notification.count({
    where: {
      organizationId,
      ...notificationScopeWhere(role, userId),
      readAt: null,
    },
  });
}

export async function markNotificationsRead(
  organizationId: string,
  role: Role,
  userId: string,
  ids?: string[],
): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: {
      organizationId,
      ...notificationScopeWhere(role, userId),
      readAt: null,
      ...(ids && ids.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return count;
}
