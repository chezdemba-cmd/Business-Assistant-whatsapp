import "server-only";
import { getEnv } from "@/lib/env";
import { logError } from "@/server/errors";
import { getJobQueue } from "@/server/jobs/queue";
import { handleInboundForAi, type InboundAiInput } from "./whatsapp-ai-service";

/**
 * `AiJobDispatcher` — abstraction du déclenchement du traitement IA après un
 * webhook WhatsApp. Le webhook NE DOIT PAS attendre le LLM (§48).
 *
 *  - `inline`  : planifié en tâche différée dans le process (après la réponse
 *    HTTP). Convient à un serveur Node long-vivant (`next start`). En
 *    environnement serverless, le worker peut être interrompu — d'où
 *    l'idempotence (`AiRun` unique par message) qui permet un rejeu sûr.
 *  - `queue`   : point d'extension pour une vraie file (BullMQ/Redis, worker
 *    séparé). Non implémenté ici — on log et on ne fait rien de bloquant.
 */
export function dispatchInboundAi(input: InboundAiInput): void {
  const mode = getEnv().AI_DISPATCH;

  if (mode === "queue") {
    void getJobQueue()
      .enqueue({
        type: "AI_PROCESS",
        organizationId: input.organizationId,
        payload: {
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          messageId: input.messageId,
        },
        dedupeParts: [input.messageId, "ai"],
      })
      .catch((error) =>
        logError("ai.dispatcher.enqueue", error, { conversationId: input.conversationId }),
      );
    return;
  }

  const schedule =
    typeof setImmediate === "function"
      ? (fn: () => void) => setImmediate(fn)
      : (fn: () => void) => setTimeout(fn, 0);

  schedule(() => {
    void handleInboundForAi(input).catch((error) => {
      logError("ai.dispatcher.inline", {
        conversationId: input.conversationId,
        error: error instanceof Error ? error.message : "unknown",
      });
    });
  });
}
