import "server-only";
import { getEnv } from "@/lib/env";
import { logError } from "@/server/errors";
import type {
  AiGenerateResult,
  AiMessage,
  AiProvider,
} from "./provider-types";
import { MockAiProvider } from "./mock-provider";

export type { AiGenerateResult, AiMessage, AiProvider } from "./provider-types";
export { MockAiProvider } from "./mock-provider";

/**
 * Fabrique du fournisseur LLM. Le provider apporte le RAISONNEMENT
 * linguistique ; toutes les données métier restent gérées par Djeli. On peut
 * remplacer OpenAI / Claude / Gemini sans toucher à la logique métier.
 */

/** API compatible OpenAI (`/chat/completions`, `response_format: json_object`). */
class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;

  constructor(cfg: {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    maxTokens: number;
  }) {
    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.model = cfg.model;
    this.timeoutMs = cfg.timeoutMs;
    this.maxTokens = cfg.maxTokens;
  }

  async generateStructured(input: {
    system: string;
    messages: AiMessage[];
  }): Promise<AiGenerateResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          max_tokens: this.maxTokens,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: input.system }, ...input.messages],
        }),
      });
      if (!res.ok) throw new Error(`AI provider HTTP ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = data.choices?.[0]?.message?.content ?? "{}";
      let raw: unknown;
      try {
        raw = JSON.parse(content);
      } catch {
        raw = {};
      }
      return {
        raw,
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null,
      };
    } catch (error) {
      logError("ai.provider.generateStructured", error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const env = getEnv();
  if (
    env.AI_PROVIDER === "openai-compatible" &&
    env.AI_API_KEY &&
    env.AI_BASE_URL
  ) {
    cached = new OpenAiCompatibleProvider({
      apiKey: env.AI_API_KEY,
      baseUrl: env.AI_BASE_URL,
      model: env.AI_MODEL,
      timeoutMs: env.AI_TIMEOUT_MS,
      maxTokens: env.AI_MAX_TOKENS,
    });
    return cached;
  }
  // Repli mock. `getEnv()` a déjà bloqué le démarrage en production si
  // AI_PROVIDER=mock sans AI_ALLOW_MOCK_IN_PROD=1 (§12). Ici on trace le repli
  // dû à une config `openai-compatible` incomplète.
  if (env.AI_PROVIDER === "openai-compatible") {
    logError("ai.provider.fallbackToMock", {
      reason: "AI_API_KEY / AI_BASE_URL manquant",
    });
  }
  cached = new MockAiProvider();
  return cached;
}

export function __setAiProviderForTests(p: AiProvider | null): void {
  cached = p;
}
