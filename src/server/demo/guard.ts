import "server-only";
import { prisma } from "@/server/db/client";
import { getEnv } from "@/lib/env";
import { Forbidden } from "@/server/errors";

/**
 * Garde-fou « organisation de démonstration » (§25).
 *
 * Une organisation `isDemo = true` ne doit JAMAIS déclencher d'action pouvant
 * toucher un vrai client (campagne réelle, envoi WhatsApp externe), sauf si
 * `DEMO_ALLOW_EXTERNAL_SEND=true` est explicitement posé sur l'environnement.
 *
 * En staging, `WHATSAPP_PROVIDER=mock` neutralise déjà les envois ; ce garde-fou
 * est une défense en profondeur pour le cas où un provider réel serait branché.
 */
export async function assertDemoExternalSendAllowed(
  organizationId: string,
  action = "cet envoi",
): Promise<void> {
  if (getEnv().DEMO_ALLOW_EXTERNAL_SEND === "true") return;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { isDemo: true },
  });
  if (org?.isDemo) {
    throw Forbidden(
      `Organisation de démonstration : ${action} vers un vrai destinataire est désactivé ` +
        "(définir DEMO_ALLOW_EXTERNAL_SEND=true pour l'autoriser).",
    );
  }
}
