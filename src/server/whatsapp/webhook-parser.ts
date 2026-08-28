import type { MessageStatus, MessageType } from "@prisma/client";

/**
 * Normalisation d'un payload webhook WhatsApp Cloud API — PUR (aucune I/O).
 *
 * Structure Meta (simplifiée) :
 *   { object, entry: [ { id, changes: [ { field: "messages", value: {
 *       metadata: { phone_number_id, display_phone_number },
 *       contacts: [ { profile: { name }, wa_id } ],
 *       messages: [ { from, id, timestamp, type, text: { body }, ... } ],
 *       statuses: [ { id, status, timestamp, recipient_id, errors: [...] } ]
 *   } } ] } ] }
 */

export type ParsedInboundMessage = {
  externalMessageId: string;
  from: string;
  type: MessageType;
  text: string | null;
  mediaId: string | null;
  mediaMimeType: string | null;
  mediaCaption: string | null;
  replyToExternalId: string | null;
  timestamp: Date | null;
};

export type ParsedStatusUpdate = {
  externalMessageId: string;
  status: MessageStatus;
  recipientWaId: string | null;
  timestamp: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type ParsedWebhookEvent = {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  contactName: string | null;
  contactWaId: string | null;
  messages: ParsedInboundMessage[];
  statuses: ParsedStatusUpdate[];
};

export type ParsedWebhook = {
  object: string | null;
  events: ParsedWebhookEvent[];
};

const TYPE_MAP: Record<string, MessageType> = {
  text: "TEXT",
  image: "IMAGE",
  document: "DOCUMENT",
  audio: "AUDIO",
  voice: "AUDIO",
  video: "VIDEO",
  location: "LOCATION",
  contacts: "CONTACT",
  interactive: "INTERACTIVE",
  button: "INTERACTIVE",
};

const STATUS_MAP: Record<string, MessageStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Timestamps Meta = secondes epoch (string). */
function parseTs(v: unknown): Date | null {
  const s = typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 1000);
}

function parseInbound(raw: unknown): ParsedInboundMessage | null {
  const m = asRecord(raw);
  const id = asString(m.id);
  const from = asString(m.from);
  if (!id || !from) return null;

  const rawType = asString(m.type) ?? "unknown";
  const type = TYPE_MAP[rawType] ?? "UNKNOWN";

  let text: string | null = null;
  let mediaId: string | null = null;
  let mediaMimeType: string | null = null;
  let mediaCaption: string | null = null;

  if (type === "TEXT") {
    text = asString(asRecord(m.text).body);
  } else if (type === "INTERACTIVE") {
    const inter = asRecord(m.interactive);
    text =
      asString(asRecord(inter.button_reply).title) ??
      asString(asRecord(inter.list_reply).title);
  } else if (type === "LOCATION") {
    const loc = asRecord(m.location);
    text = asString(loc.name) ?? asString(loc.address);
  } else {
    // image / document / audio / video / voice
    const mediaKey = rawType === "voice" ? "voice" : rawType;
    const media = asRecord(m[mediaKey]);
    mediaId = asString(media.id);
    mediaMimeType = asString(media.mime_type);
    mediaCaption = asString(media.caption);
  }

  const context = asRecord(m.context);

  return {
    externalMessageId: id,
    from,
    type,
    text,
    mediaId,
    mediaMimeType,
    mediaCaption,
    replyToExternalId: asString(context.id),
    timestamp: parseTs(m.timestamp),
  };
}

function parseStatus(raw: unknown): ParsedStatusUpdate | null {
  const s = asRecord(raw);
  const id = asString(s.id);
  const status = STATUS_MAP[asString(s.status) ?? ""];
  if (!id || !status) return null;

  const err = asRecord(asArray(s.errors)[0]);
  return {
    externalMessageId: id,
    status,
    recipientWaId: asString(s.recipient_id),
    timestamp: parseTs(s.timestamp),
    errorCode:
      err.code != null ? String(err.code) : asString(err.code) ?? null,
    errorMessage: asString(err.title) ?? asString(err.message),
  };
}

export function parseWhatsAppWebhook(payload: unknown): ParsedWebhook {
  const root = asRecord(payload);
  const events: ParsedWebhookEvent[] = [];

  for (const entry of asArray(root.entry)) {
    for (const change of asArray(asRecord(entry).changes)) {
      const c = asRecord(change);
      if (c.field !== "messages") continue;
      const value = asRecord(c.value);
      const meta = asRecord(value.metadata);
      const phoneNumberId = asString(meta.phone_number_id);
      if (!phoneNumberId) continue;

      const firstContact = asRecord(asArray(value.contacts)[0]);

      events.push({
        phoneNumberId,
        displayPhoneNumber: asString(meta.display_phone_number),
        contactName: asString(asRecord(firstContact.profile).name),
        contactWaId: asString(firstContact.wa_id),
        messages: asArray(value.messages)
          .map(parseInbound)
          .filter((x): x is ParsedInboundMessage => x !== null),
        statuses: asArray(value.statuses)
          .map(parseStatus)
          .filter((x): x is ParsedStatusUpdate => x !== null),
      });
    }
  }

  return { object: asString(root.object), events };
}
