import "server-only";
import { getEnv } from "@/lib/env";
import { logError } from "@/server/errors";
import type {
  VoiceProvider,
  VoiceTranscribeInput,
  VoiceTranscribeResult,
} from "./provider-types";
import { MockVoiceProvider } from "./mock-provider";

export type {
  VoiceProvider,
  VoiceTranscribeInput,
  VoiceTranscribeResult,
} from "./provider-types";
export { MockVoiceProvider } from "./mock-provider";

/**
 * Provider speech-to-text compatible OpenAI (`POST {base}/audio/transcriptions`,
 * multipart `file` + `model` + `language?`). Architecture remplaçable ; la clé
 * API n'est jamais exposée au frontend ni journalisée.
 */
class OpenAiCompatibleVoiceProvider implements VoiceProvider {
  readonly name = "openai-compatible";
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(cfg: {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
  }) {
    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.model = cfg.model;
    this.timeoutMs = cfg.timeoutMs;
  }

  async transcribe(input: VoiceTranscribeInput): Promise<VoiceTranscribeResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const form = new FormData();
      form.append(
        "file",
        new Blob([Buffer.from(input.audio)], { type: input.mimeType || "audio/ogg" }),
        "audio",
      );
      form.append("model", this.model);
      form.append("response_format", "verbose_json");
      if (input.languageHint) form.append("language", input.languageHint);

      const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Voice provider HTTP ${res.status}`);

      const data = (await res.json()) as {
        text?: string;
        language?: string;
        duration?: number;
        segments?: Array<{ avg_logprob?: number; no_speech_prob?: number }>;
      };

      const avgLogprob =
        data.segments && data.segments.length > 0
          ? data.segments.reduce((s, x) => s + (x.avg_logprob ?? -1), 0) /
            data.segments.length
          : null;
      const confidence =
        avgLogprob == null
          ? null
          : Math.max(0, Math.min(1, Math.exp(avgLogprob)));

      return {
        text: (data.text ?? "").trim(),
        detectedLanguage: data.language ?? null,
        confidence,
        durationMs:
          typeof data.duration === "number"
            ? Math.round(data.duration * 1000)
            : null,
        provider: this.name,
        model: this.model,
      };
    } catch (error) {
      logError("voice.provider.transcribe", error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

const DEFAULT_OPENAI_VOICE_BASE_URL = "https://api.openai.com/v1";

let cached: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (cached) return cached;
  const env = getEnv();
  if (env.VOICE_PROVIDER === "openai-compatible" && env.VOICE_API_KEY) {
    const baseUrl = env.VOICE_BASE_URL || DEFAULT_OPENAI_VOICE_BASE_URL;
    cached = new OpenAiCompatibleVoiceProvider({
      apiKey: env.VOICE_API_KEY,
      baseUrl,
      model: env.VOICE_MODEL,
      timeoutMs: env.VOICE_TIMEOUT_MS,
    });
    return cached;
  }
  // Repli mock. `getEnv()` bloque déjà le démarrage en production si
  // VOICE_PROVIDER=mock sans VOICE_ALLOW_MOCK_IN_PROD=1 (§12).
  if (env.VOICE_PROVIDER === "openai-compatible") {
    logError("voice.provider.fallbackToMock", {
      reason: "VOICE_API_KEY manquant",
    });
  }
  cached = new MockVoiceProvider();
  return cached;
}

export function __setVoiceProviderForTests(p: VoiceProvider | null): void {
  cached = p;
}
