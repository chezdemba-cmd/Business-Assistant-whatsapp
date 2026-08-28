import "server-only";
import { Prisma, type WhatsAppConnection, type WhatsAppProvider as DbProvider } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { Conflict } from "@/server/errors";
import { writeAuditLog } from "@/server/audit/log";
import { decryptSecret, encryptSecret } from "./crypto";

/**
 * Gestion du numéro WhatsApp Business d'une organisation.
 * MVP : un seul enregistrement (donc un seul numéro) par organisation.
 * Le token n'est jamais renvoyé au client — seul `getDecryptedToken` (serveur)
 * le déchiffre, à l'usage strict d'un appel sortant.
 */

/** Vue « sûre » d'une connexion : sans le token, même chiffré. */
export type SafeConnection = Omit<
  WhatsAppConnection,
  "accessTokenEncrypted" | "webhookSecret"
> & { hasToken: boolean };

function toSafe(c: WhatsAppConnection): SafeConnection {
  const { accessTokenEncrypted, webhookSecret: _webhookSecret, ...rest } = c;
  return { ...rest, hasToken: Boolean(accessTokenEncrypted) };
}

export async function getConnectionForOrg(
  organizationId: string,
): Promise<SafeConnection | null> {
  const c = await prisma.whatsAppConnection.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  return c ? toSafe(c) : null;
}

export async function getActiveConnectionForOrg(
  organizationId: string,
): Promise<WhatsAppConnection | null> {
  return prisma.whatsAppConnection.findFirst({
    where: { organizationId, status: "CONNECTED" },
    orderBy: { createdAt: "asc" },
  });
}

/** Interne (webhook) : le tenant est déterminé par le Phone Number ID. */
export async function getConnectionByPhoneNumberId(
  phoneNumberId: string,
): Promise<WhatsAppConnection | null> {
  return prisma.whatsAppConnection.findUnique({ where: { phoneNumberId } });
}

export function getDecryptedToken(
  connection: Pick<WhatsAppConnection, "accessTokenEncrypted">,
): string | null {
  if (!connection.accessTokenEncrypted) return null;
  try {
    return decryptSecret(connection.accessTokenEncrypted);
  } catch {
    return null;
  }
}

export type ConnectWhatsAppInput = {
  organizationId: string;
  actorUserId: string;
  provider?: DbProvider;
  phoneNumberId: string;
  businessAccountId?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  accessToken: string;
};

export async function connectWhatsApp(
  input: ConnectWhatsAppInput,
): Promise<{ connectionId: string; status: string }> {
  const provider: DbProvider = input.provider ?? "META_CLOUD";
  const accessTokenEncrypted =
    provider === "MOCK" && !input.accessToken
      ? null
      : encryptSecret(input.accessToken || "mock-token");

  const existing = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: input.organizationId },
  });

  const data = {
    provider,
    phoneNumberId: input.phoneNumberId.trim(),
    businessAccountId: input.businessAccountId?.trim() || null,
    displayPhoneNumber: input.displayPhoneNumber?.trim() || null,
    verifiedName: input.verifiedName?.trim() || null,
    accessTokenEncrypted,
    status: "CONNECTED" as const,
    lastError: null,
    connectedAt: new Date(),
    disconnectedAt: null,
  };

  let connection: WhatsAppConnection;
  try {
    connection = existing
      ? await prisma.whatsAppConnection.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.whatsAppConnection.create({
          data: { organizationId: input.organizationId, ...data },
        });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw Conflict(
        "Ce numéro WhatsApp est déjà connecté à une autre organisation.",
      );
    }
    throw e;
  }

  await writeAuditLog({
    action: "WHATSAPP_CONNECTED",
    entityType: "whatsapp_connection",
    entityId: connection.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    // Jamais de token dans les métadonnées d'audit.
    metadata: {
      provider,
      phoneNumberId: connection.phoneNumberId,
      displayPhoneNumber: connection.displayPhoneNumber,
    },
  });

  return { connectionId: connection.id, status: connection.status };
}

export async function disconnectWhatsApp(input: {
  organizationId: string;
  actorUserId: string;
}): Promise<{ ok: true }> {
  const existing = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: input.organizationId },
  });
  if (!existing) throw Conflict("Aucune connexion WhatsApp à déconnecter.");

  await prisma.whatsAppConnection.update({
    where: { id: existing.id },
    data: {
      status: "DISCONNECTED",
      accessTokenEncrypted: null,
      disconnectedAt: new Date(),
    },
  });

  await writeAuditLog({
    action: "WHATSAPP_DISCONNECTED",
    entityType: "whatsapp_connection",
    entityId: existing.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { phoneNumberId: existing.phoneNumberId },
  });

  return { ok: true };
}

/** Marque une connexion en erreur (diagnostic UI). */
export async function markConnectionError(
  connectionId: string,
  message: string,
): Promise<void> {
  await prisma.whatsAppConnection.update({
    where: { id: connectionId },
    data: { status: "ERROR", lastError: message.slice(0, 500) },
  });
}
