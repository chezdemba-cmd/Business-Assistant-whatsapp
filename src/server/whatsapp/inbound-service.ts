import "server-only";
import { Prisma, type WhatsAppConnection } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logError } from "@/server/errors";
import { toE164OrNull } from "@/lib/identifiers";
import { findOrCreateConversation } from "./conversation-service";
import { applyStatusUpdate } from "./status-service";
import { dispatchInboundAi } from "@/server/ai/dispatcher";
import { dispatchVoiceJob } from "@/server/voice/voice-job-dispatcher";
import type {
  ParsedInboundMessage,
  ParsedWebhook,
  ParsedWebhookEvent,
} from "./webhook-parser";

/**
 * Traitement d'un payload webhook normalisé. Pour chaque événement :
 *  1. Phone Number ID → WhatsAppConnection → Organization (le tenant vient
 *     TOUJOURS du numéro destinataire, jamais du numéro client).
 *  2. messages entrants → `ingestInboundMessage` (idempotent).
 *  3. statuts → `applyStatusUpdate`.
 *
 * Sans crash sur une erreur transitoire : Meta pourra redélivrer sans dcommage
 * grâce à l'idempotence (`(organizationId, externalMessageId)` unique).
 */
export type WebhookProcessingResult = {
  events: number;
  ingested: number;
  deduped: number;
  statuses: number;
  skippedUnknownConnection: number;
};

export async function processWhatsAppWebhook(
  parsed: ParsedWebhook,
): Promise<WebhookProcessingResult> {
  const result: WebhookProcessingResult = {
    events: parsed.events.length,
    ingested: 0,
    deduped: 0,
    statuses: 0,
    skippedUnknownConnection: 0,
  };

  for (const event of parsed.events) {
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { phoneNumberId: event.phoneNumberId },
    });
    if (!connection) {
      result.skippedUnknownConnection += 1;
      // Log technique : id externe seulement, aucun secret ni contenu.
      logError("whatsapp.webhook.unknownConnection", {
        phoneNumberId: event.phoneNumberId,
        messageCount: event.messages.length,
        statusCount: event.statuses.length,
      });
      continue;
    }

    if (event.messages.length > 0 || event.statuses.length > 0) {
      await prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: { lastEventAt: new Date() },
      });
    }

    for (const msg of event.messages) {
      try {
        const res = await ingestInboundMessage(connection, event, msg);
        if (res.outcome === "ingested") {
          result.ingested += 1;
          // Traitements post-webhook (jamais dans la requête Meta) :
          if (res.conversationId && res.messageId) {
            if (res.type === "AUDIO") {
              // Djeli Voice : transcription d'abord (elle enchaînera sur l'IA
              // si la conversation est en AUTO). Utile aussi en HUMAN (§18).
              dispatchVoiceJob({
                organizationId: connection.organizationId,
                conversationId: res.conversationId,
                messageId: res.messageId,
              });
            } else if (res.mode === "AUTO") {
              dispatchInboundAi({
                organizationId: connection.organizationId,
                conversationId: res.conversationId,
                messageId: res.messageId,
              });
            }
          }
        } else {
          result.deduped += 1;
        }
      } catch (error) {
        logError("whatsapp.webhook.ingest", {
          conversationHint: event.phoneNumberId,
          externalMessageId: msg.externalMessageId,
          error: error instanceof Error ? error.message : "unknown",
        });
        throw error; // laisse Meta redélivrer ; l'idempotence protège.
      }
    }

    for (const status of event.statuses) {
      const { applied } = await applyStatusUpdate(
        connection.organizationId,
        status,
      );
      if (applied) result.statuses += 1;
    }
  }

  return result;
}

function normalizeWaPhone(waId: string): string {
  const digits = waId.replace(/[^\d]/g, "");
  return toE164OrNull(`+${digits}`) ?? `+${digits}`;
}

async function resolveOrCreateCustomer(
  organizationId: string,
  phone: string,
  contactName: string | null,
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.customer.findUnique({
    where: { organizationId_phone: { organizationId, phone } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  try {
    const created = await prisma.customer.create({
      data: {
        organizationId,
        displayName: contactName?.trim() || phone,
        phone,
        source: "WHATSAPP",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    await prisma.customerActivity.create({
      data: {
        organizationId,
        customerId: created.id,
        type: "CUSTOMER_CREATED",
        title: "Client créé depuis WhatsApp",
        metadata: { source: "WHATSAPP" },
      },
    });
    return { id: created.id, created: true };
  } catch (e) {
    // Course : un autre webhook a créé le client entre-temps.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await prisma.customer.findUnique({
        where: { organizationId_phone: { organizationId, phone } },
        select: { id: true },
      });
      if (again) return { id: again.id, created: false };
    }
    throw e;
  }
}

const MEDIA_PREVIEW: Record<string, string> = {
  IMAGE: "Image reçue",
  AUDIO: "Audio reçu",
  VIDEO: "Vidéo reçue",
  DOCUMENT: "Document reçu",
  LOCATION: "Position reçue",
  CONTACT: "Contact reçu",
  INTERACTIVE: "Réponse reçue",
  UNKNOWN: "Message reçu",
};

type IngestResult = {
  outcome: "ingested" | "deduped";
  conversationId?: string;
  messageId?: string;
  mode?: "AUTO" | "HUMAN" | "PAUSED";
  type?: string;
};

async function ingestInboundMessage(
  connection: WhatsAppConnection,
  event: ParsedWebhookEvent,
  msg: ParsedInboundMessage,
): Promise<IngestResult> {
  const organizationId = connection.organizationId;

  // Idempotence : ce message a-t-il déjà été enregistré ?
  const seen = await prisma.message.findUnique({
    where: {
      organizationId_externalMessageId: {
        organizationId,
        externalMessageId: msg.externalMessageId,
      },
    },
    select: { id: true },
  });
  if (seen) return { outcome: "deduped" };

  const phone = normalizeWaPhone(msg.from);
  const customer = await resolveOrCreateCustomer(
    organizationId,
    phone,
    event.contactName,
  );

  const ts = msg.timestamp ?? new Date();
  const preview =
    msg.type === "TEXT" && msg.text
      ? msg.text
      : MEDIA_PREVIEW[msg.type] ?? "Message reçu";

  try {
    const ids = await prisma.$transaction(async (tx) => {
      const conversation = await findOrCreateConversation(tx, {
        organizationId,
        whatsappConnectionId: connection.id,
        externalWaId: msg.from,
        customerId: customer.id,
      });

      const created = await tx.message.create({
        data: {
          organizationId,
          conversationId: conversation.id,
          whatsappConnectionId: connection.id,
          customerId: customer.id,
          externalMessageId: msg.externalMessageId,
          direction: "INBOUND",
          type: msg.type,
          status: "RECEIVED",
          body: msg.text,
          mediaId: msg.mediaId,
          mediaMimeType: msg.mediaMimeType,
          mediaCaption: msg.mediaCaption,
          providerTimestamp: ts,
        },
        select: { id: true },
      });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          customerId: conversation.customerId ?? customer.id,
          lastMessageAt: ts,
          lastInboundAt: ts,
          unreadCount: { increment: 1 },
          status: "OPEN",
        },
      });

      await tx.customerActivity.create({
        data: {
          organizationId,
          customerId: customer.id,
          type: "MESSAGE_RECEIVED",
          title:
            preview.length > 120 ? `${preview.slice(0, 117)}…` : preview,
          // Métadonnées volontairement minimales — jamais le payload Meta brut.
          metadata: {
            conversationId: conversation.id,
            type: msg.type,
          },
        },
      });

      return {
        conversationId: conversation.id,
        messageId: created.id,
        mode: conversation.mode,
        type: msg.type,
      };
    });
    return { outcome: "ingested", ...ids };
  } catch (e) {
    // Unicité (organizationId, externalMessageId) violée par un retry parallèle.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { outcome: "deduped" };
    }
    throw e;
  }
}
