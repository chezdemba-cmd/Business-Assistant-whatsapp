import { logger } from "@/lib/logger";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./provider-types";

/**
 * Provider e-mail DÉTERMINISTE — dev / test. N'envoie RIEN : journalise
 * l'expédition (sujet + destinataire, jamais le corps HTML complet) et renvoie
 * toujours un succès. Le lien de réinitialisation apparaît dans les logs pour
 * pouvoir tester le parcours en local.
 */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock" as const;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    logger.info("email.mock.send", {
      service: "email",
      to: message.to,
      subject: message.subject,
      // Aide au test local : on montre le texte brut (contient le lien), jamais en prod.
      preview: message.text.slice(0, 300),
    });
    return { ok: true, id: `mock-${Date.now()}` };
  }
}
