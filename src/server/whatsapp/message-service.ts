import "server-only";
import type { WhatsAppConnection } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { Conflict, Forbidden, NotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import { getDecryptedToken } from "./connection-service";
import { getWhatsAppProvider } from "./provider";
import { recordUsage } from "@/server/billing/usage-service";
import { assertDemoExternalSendAllowed } from "@/server/demo/guard";
import { isCustomerServiceWindowOpen } from "./service-window";
import { nextModeOnHumanReply } from "./conversation-mode";
import type {
  WhatsAppSendResult,
  WhatsAppTemplateComponent,
} from "./types";

/**
 * Primitives d'envoi bas niveau — réutilisables par Phase 6 (Djeli IA) et
 * Phase 7 (relances par template). Ne créent PAS de Message en base : c'est
 * l'appelant qui décide de la persistance.
 */
function sendContext(connection: WhatsAppConnection, toWaId: string) {
  const token = getDecryptedToken(connection) ?? "";
  return { phoneNumberId: connection.phoneNumberId, accessToken: token, toWaId };
}

export function sendText(
  connection: WhatsAppConnection,
  toWaId: string,
  body: string,
): Promise<WhatsAppSendResult> {
  return getWhatsAppProvider().sendText(sendContext(connection, toWaId), body);
}

export function sendTemplate(
  connection: WhatsAppConnection,
  toWaId: string,
  template: {
    name: string;
    languageCode: string;
    components?: WhatsAppTemplateComponent[];
  },
): Promise<WhatsAppSendResult> {
  return getWhatsAppProvider().sendTemplate(
    sendContext(connection, toWaId),
    template,
  );
}

/**
 * Réponse AUTOMATIQUE de Djeli IA (Phase 6). L'IA agit au nom de
 * l'organisation : `sentByUserId` reste nul, `generatedByAi = true`. Ne bascule
 * PAS AUTO → HUMAN (c'est l'IA qui répond). La fenêtre 24 h doit avoir été
 * vérifiée en amont par le pipeline IA.
 */
export async function sendAiConversationMessage(input: {
  organizationId: string;
  conversationId: string;
  body: string;
  aiRunId: string;
}): Promise<{ messageId: string; status: "SENT" | "FAILED" }> {
  const body = input.body.trim();
  if (!body) throw Conflict("Réponse IA vide.");

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId },
    include: {
      whatsappConnection: true,
      organization: { select: { timezone: true } },
    },
  });
  if (!conversation) throw NotFound("Conversation introuvable.");
  if (conversation.whatsappConnection.status !== "CONNECTED") {
    throw Conflict("Numéro WhatsApp non connecté.");
  }

  const result = await sendText(
    conversation.whatsappConnection,
    conversation.externalWaId,
    body.slice(0, 4096),
  );
  const now = new Date();

  const message = await prisma.message.create({
    data: {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      whatsappConnectionId: conversation.whatsappConnectionId,
      customerId: conversation.customerId,
      externalMessageId: result.ok ? result.externalMessageId : null,
      direction: "OUTBOUND",
      type: "TEXT",
      status: result.ok ? "SENT" : "FAILED",
      body: body.slice(0, 4096),
      generatedByAi: true,
      aiRunId: input.aiRunId,
      providerTimestamp: now,
      ...(result.ok
        ? {}
        : { errorCode: result.errorCode, errorMessage: result.errorMessage.slice(0, 500) }),
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: now, lastOutboundAt: now },
  });

  if (result.ok) {
    void recordUsage(
      input.organizationId,
      "WHATSAPP_MESSAGES",
      1,
      conversation.organization.timezone,
    );
  }
  return { messageId: message.id, status: result.ok ? "SENT" : "FAILED" };
}

/**
 * Réponse humaine depuis l'application (§23).
 * Vérifie connexion active + fenêtre 24 h, envoie via le provider, persiste le
 * Message OUTBOUND (SENT ou FAILED), met à jour la conversation, bascule
 * AUTO → HUMAN, journalise (CustomerActivity MESSAGE_SENT + audit MESSAGE_SENT).
 */
export type SendConversationMessageInput = {
  organizationId: string;
  actorUserId: string;
  conversationId: string;
  body: string;
};

export async function sendConversationMessage(
  input: SendConversationMessageInput,
): Promise<{
  messageId: string;
  status: "SENT" | "FAILED";
  modeSwitchedToHuman: boolean;
}> {
  const body = input.body.trim();
  if (!body) throw Conflict("Le message est vide.");
  if (body.length > 4096) throw Conflict("Message trop long (4096 caractères max).");
  await assertDemoExternalSendAllowed(input.organizationId, "l'envoi d'un message WhatsApp");

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId },
    include: {
      whatsappConnection: true,
      customer: { select: { id: true } },
      organization: { select: { timezone: true } },
    },
  });
  if (!conversation) {
    throw NotFound("Conversation introuvable dans cette entreprise.");
  }

  const connection = conversation.whatsappConnection;
  if (connection.status !== "CONNECTED") {
    throw Conflict(
      "Le numéro WhatsApp n'est pas connecté. Vérifiez Paramètres → WhatsApp.",
    );
  }

  if (getWhatsAppProvider().name === "meta" && !getDecryptedToken(connection)) {
    throw Forbidden("Jeton WhatsApp indisponible. Reconnectez le numéro.");
  }

  if (!isCustomerServiceWindowOpen(conversation.lastInboundAt)) {
    throw Conflict(
      "La fenêtre de 24 h est fermée. Un modèle WhatsApp approuvé est nécessaire pour répondre.",
    );
  }

  const result = await sendText(connection, conversation.externalWaId, body);
  const now = new Date();
  const switchMode = nextModeOnHumanReply(conversation.mode) !== conversation.mode;

  const message = await prisma.message.create({
    data: {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      whatsappConnectionId: connection.id,
      customerId: conversation.customerId,
      externalMessageId: result.ok ? result.externalMessageId : null,
      direction: "OUTBOUND",
      type: "TEXT",
      status: result.ok ? "SENT" : "FAILED",
      body,
      sentByUserId: input.actorUserId,
      providerTimestamp: now,
      ...(result.ok
        ? {}
        : { errorCode: result.errorCode, errorMessage: result.errorMessage.slice(0, 500) }),
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: now,
      lastOutboundAt: now,
      ...(switchMode ? { mode: "HUMAN" as const } : {}),
    },
  });

  if (switchMode) {
    await writeAuditLog({
      action: "CONVERSATION_MODE_CHANGED",
      entityType: "conversation",
      entityId: conversation.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      metadata: { from: conversation.mode, to: "HUMAN", reason: "human_reply" },
    });
  }

  if (result.ok && conversation.customerId) {
    await prisma.customerActivity.create({
      data: {
        organizationId: input.organizationId,
        customerId: conversation.customerId,
        type: "MESSAGE_SENT",
        title: body.length > 120 ? `${body.slice(0, 117)}…` : body,
        actorUserId: input.actorUserId,
        metadata: { conversationId: conversation.id, messageId: message.id },
      },
    });
  }

  await writeAuditLog({
    action: "MESSAGE_SENT",
    entityType: "message",
    entityId: message.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: {
      conversationId: conversation.id,
      status: message.status,
      ...(result.ok ? {} : { errorCode: result.errorCode }),
    },
  });

  if (!result.ok) {
    // Message FAILED persisté ; on remonte une erreur utilisateur propre.
    throw Conflict(
      result.errorMessage || "L'envoi du message WhatsApp a échoué.",
    );
  }

  void recordUsage(
    input.organizationId,
    "WHATSAPP_MESSAGES",
    1,
    conversation.organization.timezone,
  );
  return {
    messageId: message.id,
    status: "SENT",
    modeSwitchedToHuman: switchMode,
  };
}
