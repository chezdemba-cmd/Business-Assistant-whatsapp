import "server-only";
import type { WhatsAppConnection } from "@prisma/client";
import { getEnv } from "@/lib/env";
import { logError } from "@/server/errors";
import { getDecryptedToken } from "@/server/whatsapp/connection-service";

/**
 * Récupération d'un média WhatsApp (audio) côté serveur.
 *  1. GET graph.facebook.com/{v}/{mediaId} → { url, mime_type, file_size }
 *  2. GET url (Bearer) → octets
 *
 * Le token WhatsApp n'apparaît jamais côté client ni dans les logs. Le binaire
 * n'est pas persisté : l'appelant le transmet au provider puis le jette.
 */

export type DownloadedAudio = {
  bytes: Uint8Array;
  mimeType: string;
  sizeBytes: number;
};

export class AudioDownloadError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AudioDownloadError";
    this.code = code;
  }
}

const AUDIO_MIME_ALLOW = [
  "audio/ogg",
  "audio/opus",
  "audio/mpeg",
  "audio/mp4",
  "audio/mp3",
  "audio/amr",
  "audio/aac",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
];

export async function downloadWhatsAppMedia(input: {
  connection: WhatsAppConnection;
  mediaId: string;
}): Promise<DownloadedAudio> {
  const env = getEnv();
  const maxBytes = Math.round(env.VOICE_MAX_FILE_MB * 1024 * 1024);

  const token = getDecryptedToken(input.connection);
  if (!token || input.connection.provider !== "META_CLOUD") {
    throw new AudioDownloadError(
      "NO_MEDIA_SOURCE",
      "Connexion sans accès média Meta (provider mock ou token absent).",
    );
  }

  const version = env.META_GRAPH_API_VERSION;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.VOICE_TIMEOUT_MS);

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${version}/${encodeURIComponent(input.mediaId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    );
    if (!metaRes.ok) {
      throw new AudioDownloadError("META_LOOKUP_FAILED", `Meta media HTTP ${metaRes.status}`);
    }
    const meta = (await metaRes.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
    };
    if (!meta.url) {
      throw new AudioDownloadError("NO_URL", "Meta n'a pas renvoyé d'URL de média.");
    }
    const mimeType = (meta.mime_type ?? "audio/ogg").split(";")[0]!.trim();
    if (!AUDIO_MIME_ALLOW.includes(mimeType)) {
      throw new AudioDownloadError("BAD_MIME", `Type audio non pris en charge : ${mimeType}`);
    }
    if (typeof meta.file_size === "number" && meta.file_size > maxBytes) {
      throw new AudioDownloadError("TOO_LARGE", "Fichier audio trop volumineux.");
    }

    const binRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!binRes.ok) {
      throw new AudioDownloadError("DOWNLOAD_FAILED", `Media download HTTP ${binRes.status}`);
    }
    const buf = new Uint8Array(await binRes.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new AudioDownloadError("TOO_LARGE", "Fichier audio trop volumineux.");
    }
    if (buf.byteLength === 0) {
      throw new AudioDownloadError("EMPTY", "Fichier audio vide.");
    }
    return { bytes: buf, mimeType, sizeBytes: buf.byteLength };
  } catch (error) {
    if (error instanceof AudioDownloadError) throw error;
    logError("voice.audio.download", {
      mediaId: input.mediaId,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new AudioDownloadError("NETWORK", "Impossible de récupérer l'audio Meta.");
  } finally {
    clearTimeout(timer);
  }
}
