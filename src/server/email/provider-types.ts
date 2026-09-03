/**
 * Contrat d'un provider d'e-mail transactionnel. Aucune logique métier ici :
 * juste l'envoi d'un message déjà rendu (sujet + HTML + texte).
 */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export interface EmailProvider {
  readonly name: "mock" | "resend";
  send(message: EmailMessage): Promise<EmailSendResult>;
}
