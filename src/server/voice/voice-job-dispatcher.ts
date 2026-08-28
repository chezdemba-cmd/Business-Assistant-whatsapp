import "server-only";
import { getEnv } from "@/lib/env";
import { logError } from "@/server/errors";
import { getJobQueue } from "@/server/jobs/queue";
import { transcribeMessage } from "./transcription-service";

/**
 * `VoiceJobDispatcher` — déclenche la transcription APRÈS la réponse 200 au
 * webhook Meta (§35, §37). Jamais dans la requête Meta.
 *
 *  - `inline` : tâche différée in-process (`setImmediate`). OK sur serveur Node
 *    long-vivant ; en serverless le worker peut être interrompu — l'idempotence
 *    (`VoiceTranscription` unique par `messageId`) rend un rejeu sûr.
 *  - `queue`  : point d'extension (worker séparé) — non implémenté.
 */
export type VoiceJobInput = {
  organizationId: string;
  conversationId: string;
  messageId: string;
};

export function dispatchVoiceJob(input: VoiceJobInput): void {
  if (getEnv().VOICE_DISPATCH === "queue") {
    void getJobQueue()
      .enqueue({
        type: "VOICE_TRANSCRIBE",
        organizationId: input.organizationId,
        payload: { ...input },
        dedupeParts: [input.messageId, "voice"],
      })
      .catch((error) =>
        logError("voice.dispatcher.enqueue", error, {
          conversationId: input.conversationId,
        }),
      );
    return;
  }

  const schedule =
    typeof setImmediate === "function"
      ? (fn: () => void) => setImmediate(fn)
      : (fn: () => void) => setTimeout(fn, 0);

  schedule(() => {
    void transcribeMessage(input).catch((error) => {
      logError("voice.dispatcher.inline", {
        conversationId: input.conversationId,
        error: error instanceof Error ? error.message : "unknown",
      });
    });
  });
}
