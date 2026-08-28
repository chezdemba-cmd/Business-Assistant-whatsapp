import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Vérification de la signature `X-Hub-Signature-256` des webhooks Meta.
 * `sha256=<hex(HMAC_SHA256(appSecret, rawBody))>`. Comparaison à temps constant.
 *
 * `rawBody` DOIT être le corps brut exact reçu (jamais un objet re-sérialisé).
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string | null | undefined,
): boolean {
  if (!appSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const provided = signatureHeader.slice("sha256=".length).trim();
  if (!/^[0-9a-f]+$/i.test(provided)) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/**
 * Vérification du handshake GET du webhook Meta.
 * Retourne le `challenge` à renvoyer tel quel si le token correspond, sinon null.
 */
export function verifyWebhookSubscription(
  params: {
    mode: string | null;
    token: string | null;
    challenge: string | null;
  },
  expectedToken: string | null | undefined,
): string | null {
  if (!expectedToken) return null;
  if (params.mode !== "subscribe") return null;
  if (!params.token || params.token !== expectedToken) return null;
  return params.challenge ?? null;
}
