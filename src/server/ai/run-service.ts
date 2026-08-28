import "server-only";
import {
  Prisma,
  type AiAutomationType,
  type AiConfidence,
  type AiRunStatus,
  type AiToolCallStatus,
} from "@prisma/client";
import { prisma } from "@/server/db/client";

/**
 * Cycle de vie d'un `AiRun` + traçabilité des appels d'outils.
 * Idempotence des réponses AUTO : unique `(messageId, automationType)`.
 */

export type ClaimAiRunInput = {
  organizationId: string;
  automationType: AiAutomationType;
  conversationId?: string | null;
  messageId?: string | null;
  userId?: string | null;
  provider: string;
  model: string;
  promptVersion: string;
};

/**
 * Crée un `AiRun` PENDING. Retourne `null` si un run existe déjà pour ce
 * `(messageId, automationType)` — un même message INBOUND ne déclenche qu'une
 * exécution automatique (Meta peut redélivrer).
 */
export async function claimAiRun(
  input: ClaimAiRunInput,
): Promise<{ id: string } | null> {
  try {
    const run = await prisma.aiRun.create({
      data: {
        organizationId: input.organizationId,
        automationType: input.automationType,
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        userId: input.userId ?? null,
        provider: input.provider,
        model: input.model,
        promptVersion: input.promptVersion,
        status: "PENDING",
      },
      select: { id: true },
    });
    return run;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return null;
    }
    throw e;
  }
}

export type FinishAiRunInput = {
  status: AiRunStatus;
  intent?: string | null;
  language?: string | null;
  confidence?: AiConfidence | null;
  handoffReason?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
};

export async function finishAiRun(
  aiRunId: string,
  input: FinishAiRunInput,
): Promise<void> {
  await prisma.aiRun.update({
    where: { id: aiRunId },
    data: {
      status: input.status,
      intent: input.intent ?? null,
      language: input.language ?? null,
      confidence: input.confidence ?? null,
      handoffReason: input.handoffReason ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      latencyMs: input.latencyMs ?? null,
      errorCode: input.errorCode ?? null,
    },
  });
}

export async function recordToolCall(input: {
  aiRunId: string;
  organizationId: string;
  toolName: string;
  status: AiToolCallStatus;
  inputSummary?: string;
  outputSummary?: string;
  durationMs?: number;
}): Promise<void> {
  await prisma.aiToolCall.create({
    data: {
      aiRunId: input.aiRunId,
      organizationId: input.organizationId,
      toolName: input.toolName,
      status: input.status,
      inputSummary: input.inputSummary?.slice(0, 300) ?? null,
      outputSummary: input.outputSummary?.slice(0, 300) ?? null,
      durationMs: input.durationMs ?? null,
    },
  });
}
