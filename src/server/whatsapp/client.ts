import "server-only";
import { logError } from "@/server/errors";
import type {
  WhatsAppProvider,
  WhatsAppSendContext,
  WhatsAppSendResult,
  WhatsAppTemplateComponent,
} from "./types";

/**
 * Provider réel — WhatsApp Business Cloud API (Graph). Version centralisée via
 * `META_GRAPH_API_VERSION`. Aucun secret n'est journalisé.
 */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = "meta" as const;
  private readonly version: string;

  constructor(version: string) {
    this.version = version;
  }

  private endpoint(phoneNumberId: string): string {
    return `https://graph.facebook.com/${this.version}/${encodeURIComponent(
      phoneNumberId,
    )}/messages`;
  }

  private async post(
    ctx: WhatsAppSendContext,
    payload: Record<string, unknown>,
  ): Promise<WhatsAppSendResult> {
    try {
      const res = await fetch(this.endpoint(ctx.phoneNumberId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: ctx.toWaId,
          ...payload,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { code?: number | string; message?: string; type?: string };
      };

      if (!res.ok || data.error) {
        return {
          ok: false,
          errorCode:
            data.error?.code != null ? String(data.error.code) : String(res.status),
          // Message technique sanitisé — jamais le token ni le payload complet.
          errorMessage:
            data.error?.message ?? `Échec de l'envoi WhatsApp (HTTP ${res.status}).`,
        };
      }

      const id = data.messages?.[0]?.id;
      if (!id) {
        return {
          ok: false,
          errorCode: "NO_MESSAGE_ID",
          errorMessage: "Réponse Meta sans identifiant de message.",
        };
      }
      return { ok: true, externalMessageId: id };
    } catch (error) {
      logError("MetaWhatsAppProvider.post", error);
      return {
        ok: false,
        errorCode: "NETWORK",
        errorMessage: "Impossible de joindre l'API WhatsApp.",
      };
    }
  }

  sendText(ctx: WhatsAppSendContext, body: string): Promise<WhatsAppSendResult> {
    return this.post(ctx, { type: "text", text: { preview_url: false, body } });
  }

  sendTemplate(
    ctx: WhatsAppSendContext,
    template: {
      name: string;
      languageCode: string;
      components?: WhatsAppTemplateComponent[];
    },
  ): Promise<WhatsAppSendResult> {
    return this.post(ctx, {
      type: "template",
      template: {
        name: template.name,
        language: { code: template.languageCode },
        ...(template.components ? { components: template.components } : {}),
      },
    });
  }
}
