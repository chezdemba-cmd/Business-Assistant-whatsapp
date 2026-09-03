import "server-only";
import { logError } from "@/server/errors";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./provider-types";

/**
 * Provider e-mail Resend via l'API REST (`POST https://api.resend.com/emails`).
 * Aucune dépendance SDK — cohérent avec les autres providers (WhatsApp, IA).
 * La clé API n'est jamais journalisée.
 */
const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  private readonly apiKey: string;
  private readonly from: string;

  constructor(cfg: { apiKey: string; from: string }) {
    this.apiKey = cfg.apiKey;
    this.from = cfg.from;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
      };
      if (!res.ok) {
        return {
          ok: false,
          error: data.message ?? `Échec de l'envoi (HTTP ${res.status}).`,
        };
      }
      return { ok: true, id: data.id };
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError");
      logError("email.resend.send", error);
      return { ok: false, error: timedOut ? "Délai dépassé." : "Provider e-mail injoignable." };
    } finally {
      clearTimeout(timer);
    }
  }
}
