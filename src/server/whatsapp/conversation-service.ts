import "server-only";
import type { ConversationMode, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { Conflict, NotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import { CONVERSATION_MODE_LABEL } from "./conversation-mode";

type Tx = Prisma.TransactionClient;

/**
 * Trouve la conversation ouverte pour (connexion + externalWaId) ou la crée.
 * Idempotent grâce à l'unique `(whatsappConnectionId, externalWaId)`.
 */
export async function findOrCreateConversation(
  tx: Tx,
  input: {
    organizationId: string;
    whatsappConnectionId: string;
    externalWaId: string;
    customerId: string | null;
  },
): Promise<{ id: string; mode: ConversationMode; customerId: string | null }> {
  const conv = await tx.conversation.upsert({
    where: {
      whatsappConnectionId_externalWaId: {
        whatsappConnectionId: input.whatsappConnectionId,
        externalWaId: input.externalWaId,
      },
    },
    create: {
      organizationId: input.organizationId,
      whatsappConnectionId: input.whatsappConnectionId,
      externalWaId: input.externalWaId,
      customerId: input.customerId,
      mode: "HUMAN",
      status: "OPEN",
    },
    update: input.customerId ? { customerId: input.customerId } : {},
    select: { id: true, mode: true, customerId: true },
  });
  return conv;
}

export async function assignConversation(input: {
  organizationId: string;
  actorUserId: string;
  conversationId: string;
  assigneeUserId: string | null;
}): Promise<{ conversationId: string }> {
  const conv = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!conv) throw NotFound("Conversation introuvable dans cette entreprise.");

  if (input.assigneeUserId) {
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.assigneeUserId,
        },
      },
      select: { status: true },
    });
    if (!member || member.status !== "ACTIVE") {
      throw Conflict("Ce membre ne fait pas partie de l'entreprise.");
    }
  }

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { assignedToUserId: input.assigneeUserId },
  });

  await writeAuditLog({
    action: "CONVERSATION_ASSIGNED",
    entityType: "conversation",
    entityId: conv.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { assigneeUserId: input.assigneeUserId },
  });

  return { conversationId: conv.id };
}

export async function setConversationMode(input: {
  organizationId: string;
  actorUserId: string;
  conversationId: string;
  mode: ConversationMode;
}): Promise<{ conversationId: string; mode: ConversationMode }> {
  const conv = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId },
    select: { id: true, mode: true },
  });
  if (!conv) throw NotFound("Conversation introuvable dans cette entreprise.");

  if (conv.mode !== input.mode) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { mode: input.mode },
    });
    await writeAuditLog({
      action: "CONVERSATION_MODE_CHANGED",
      entityType: "conversation",
      entityId: conv.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      metadata: {
        from: conv.mode,
        to: input.mode,
        label: CONVERSATION_MODE_LABEL[input.mode],
      },
    });
  }

  return { conversationId: conv.id, mode: input.mode };
}

export async function markConversationRead(input: {
  organizationId: string;
  conversationId: string;
}): Promise<void> {
  await prisma.conversation.updateMany({
    where: { id: input.conversationId, organizationId: input.organizationId },
    data: { unreadCount: 0 },
  });
}
