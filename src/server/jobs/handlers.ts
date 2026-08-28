import "server-only";
import { registerJobHandler } from "./queue";
import { runAutomationJob } from "@/server/automations/scheduler";
import { handleInboundForAi } from "@/server/ai/whatsapp-ai-service";
import { transcribeMessage } from "@/server/voice/transcription-service";

/**
 * Enregistrement des handlers de jobs (§7, §32). Idempotent : appelable à
 * chaque requête / boucle worker qui traite la file. Les jobs suivants ne
 * dépendent plus d'un `setImmediate` serverless quand `*_DISPATCH=queue` :
 *   AI_PROCESS · VOICE_TRANSCRIBE · AUTOMATION_RUN · DAILY_SUMMARY · WHATSAPP_SEND
 */
let registered = false;

type P = Record<string, unknown>;
const asObj = (p: unknown): P => (p && typeof p === "object" ? (p as P) : {});
const str = (p: P, k: string): string | null => (typeof p[k] === "string" ? (p[k] as string) : null);

export function registerAllJobHandlers(): void {
  if (registered) return;
  registered = true;

  registerJobHandler("AUTOMATION_RUN", async (payload) => {
    const orgId = str(asObj(payload), "organizationId");
    if (orgId) await runAutomationJob(orgId);
  });

  registerJobHandler("DAILY_SUMMARY", async (payload) => {
    const orgId = str(asObj(payload), "organizationId");
    if (orgId) await runAutomationJob(orgId);
  });

  registerJobHandler("AI_PROCESS", async (payload) => {
    const p = asObj(payload);
    const organizationId = str(p, "organizationId");
    const conversationId = str(p, "conversationId");
    const messageId = str(p, "messageId");
    if (organizationId && conversationId && messageId) {
      await handleInboundForAi({ organizationId, conversationId, messageId });
    }
  });

  registerJobHandler("VOICE_TRANSCRIBE", async (payload) => {
    const p = asObj(payload);
    const organizationId = str(p, "organizationId");
    const conversationId = str(p, "conversationId");
    const messageId = str(p, "messageId");
    if (organizationId && conversationId && messageId) {
      await transcribeMessage({ organizationId, conversationId, messageId });
    }
  });

  registerJobHandler("WHATSAPP_SEND", async (payload) => {
    // Reprise d'envoi d'une campagne marketing en tâche de fond (idempotent :
    // seuls les items PENDING sont envoyés).
    const p = asObj(payload);
    const organizationId = str(p, "organizationId");
    const campaignId = str(p, "campaignId");
    const actorUserId = str(p, "actorUserId");
    if (organizationId && campaignId && actorUserId) {
      const { sendCampaign } = await import("@/server/marketing/campaign-service");
      await sendCampaign({ organizationId, campaignId, actorUserId });
    }
  });
}
