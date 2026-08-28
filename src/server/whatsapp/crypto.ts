import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Chiffrement des secrets WhatsApp (access token Meta) — AES-256-GCM.
 *
 * Le token n'est JAMAIS stocké en clair, ni exposé au client / logs / audit /
 * erreurs. Clé serveur : `WHATSAPP_TOKEN_ENCRYPTION_KEY` (32 octets, base64 ou
 * hex). Format de sortie : `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`.
 */

const PREFIX = "v1";

function loadKey(): Buffer {
  const raw = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "WHATSAPP_TOKEN_ENCRYPTION_KEY manquant : impossible de chiffrer/déchiffrer un token WhatsApp.",
    );
  }
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new Error(
      "WHATSAPP_TOKEN_ENCRYPTION_KEY invalide : 32 octets attendus (base64 ou hex).",
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Secret chiffré : format invalide.");
  }
  const key = loadKey();
  const iv = Buffer.from(parts[1] as string, "base64");
  const tag = Buffer.from(parts[2] as string, "base64");
  const data = Buffer.from(parts[3] as string, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

/** `true` si le chiffrement est configuré (clé présente et valide). */
export function isSecretCryptoConfigured(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}
