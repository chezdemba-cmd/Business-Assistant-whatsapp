import "server-only";

/**
 * E-mail transactionnel — abstraction (§28, §51).
 *
 * Aujourd'hui : un seul provider `log` qui **journalise** le message (dev /
 * pilote fermé) sans rien envoyer. Aucune dépendance, aucun secret requis.
 *
 * Pour brancher un vrai envoi : ajouter l'implémentation (`ResendEmailProvider`
 * / SMTP), l'exposer dans `getEmailProvider()` via `EMAIL_PROVIDER`, et fournir
 * le secret correspondant. Le reste du code ne dépend que de `EmailProvider`.
 *
 * Consommateur prévu : flux « mot de passe oublié » + envoi d'invitation
 * (non câblés dans cette passe).
 */

export type EmailMessage = {
  to: string;
  subject: string;
  /** Corps texte brut (obligatoire — sert de repli si `html` absent). */
  text: string;
  html?: string;
  /** Surcharge de l'expéditeur ; sinon `EMAIL_FROM` / défaut. */
  from?: string;
};

export type EmailSendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export interface EmailProvider {
  readonly name: "log" | "resend" | "smtp";
  send(message: EmailMessage): Promise<EmailSendResult>;
}

function defaultFrom(): string {
  return process.env.EMAIL_FROM || "Djeli <no-reply@djeli.local>";
}

/**
 * Provider de repli : ne contacte aucun service. Émet une ligne JSON
 * structurée (jamais de secret ; le corps est tronqué). Utile pour vérifier
 * les gabarits et les liens en dev / pilote fermé.
 */
export class LogEmailProvider implements EmailProvider {
  readonly name = "log" as const;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const id = `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    // eslint-disable-next-line no-console
    console.info(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        service: "email",
        event: "email.logged",
        id,
        to: message.to,
        from: message.from || defaultFrom(),
        subject: message.subject,
        bodyPreview:
          message.text.length > 300 ? `${message.text.slice(0, 300)}…` : message.text,
      }),
    );
    return { ok: true, id };
  }
}

let cached: EmailProvider | null = null;

/**
 * Fabrique le provider selon `EMAIL_PROVIDER` (défaut : `log`).
 * `resend` / `smtp` ne sont pas encore implémentés : on échoue explicitement
 * plutôt que d'« envoyer dans le vide ».
 */
export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const kind = (process.env.EMAIL_PROVIDER || "log").toLowerCase();
  if (kind !== "log") {
    throw new Error(
      `EMAIL_PROVIDER="${kind}" non implémenté. Ajouter l'implémentation ` +
        "correspondante dans src/server/email/provider.ts, ou utiliser EMAIL_PROVIDER=log.",
    );
  }
  cached = new LogEmailProvider();
  return cached;
}

/** Tests : force / réinitialise le provider. */
export function __setEmailProviderForTests(p: EmailProvider | null): void {
  cached = p;
}
