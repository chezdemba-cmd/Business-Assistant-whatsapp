import { type NextRequest } from "next/server";
import { logError } from "@/server/errors";
import {
  verifyMetaSignature,
  verifyWebhookSubscription,
} from "@/server/whatsapp/signature";
import { parseWhatsAppWebhook } from "@/server/whatsapp/webhook-parser";
import { processWhatsAppWebhook } from "@/server/whatsapp/inbound-service";
import { rateLimit } from "@/server/whatsapp/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook WhatsApp Business Cloud API.
 *
 *  GET  → handshake de souscription Meta (hub.mode / hub.verify_token / hub.challenge).
 *  POST → événements. Signature `X-Hub-Signature-256` obligatoire.
 *
 * Le tenant est déterminé plus loin par le Phone Number ID (jamais par le
 * numéro du client). Idempotence assurée par `(organizationId, externalMessageId)`.
 */

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const challenge = verifyWebhookSubscription(
    {
      mode: p.get("hub.mode"),
      token: p.get("hub.verify_token"),
      challenge: p.get("hub.challenge"),
    },
    process.env.META_WEBHOOK_VERIFY_TOKEN,
  );
  if (challenge == null) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    // Pas de secret configuré → on ne peut pas vérifier : on refuse.
    return new Response("Webhook not configured", { status: 503 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rl = rateLimit(`wa-webhook:${ip}`, 120, 60_000);
  if (!rl.allowed) {
    return new Response("Too Many Requests", { status: 429 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(raw, signature, appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const parsed = parseWhatsAppWebhook(payload);

  try {
    const result = await processWhatsAppWebhook(parsed);
    return Response.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    // Erreur transitoire (DB…) : 500 → Meta redélivrera, l'idempotence protège.
    logError("whatsapp.webhook.POST", {
      events: parsed.events.length,
      phoneNumberIds: parsed.events.map((e) => e.phoneNumberId),
      error: error instanceof Error ? error.message : "unknown",
    });
    return new Response("Processing error", { status: 500 });
  }
}
