import "server-only";
import { getAiProvider, type AiMessage } from "./provider";
import { runCapability, type CapabilityContext } from "./capabilities";
import { recordToolCall } from "./run-service";
import { safeParseTurnPlan, type AiTurnPlan } from "./schema";

/**
 * Un « tour » de raisonnement : passe 1 (le modèle demande des outils), on
 * exécute les outils autorisés, passe 2 (le modèle répond avec les données).
 * Bornée à UN aller-retour d'outils (≤ 4 outils) — pas d'agent en boucle.
 */
export type AiTurnOutcome = {
  plan: AiTurnPlan;
  toolResults: Record<string, unknown>;
  toolNames: string[];
  inputTokens: number | null;
  outputTokens: number | null;
};

export async function runAiTurn(params: {
  capCtx: CapabilityContext;
  aiRunId: string;
  system: string;
  conversation: AiMessage[];
}): Promise<AiTurnOutcome> {
  const provider = getAiProvider();

  const pass1 = await provider.generateStructured({
    system: params.system,
    messages: params.conversation,
  });
  const plan1 = safeParseTurnPlan(pass1.raw);

  let inTok = pass1.inputTokens;
  let outTok = pass1.outputTokens;

  if (plan1.toolRequests.length === 0) {
    return {
      plan: plan1,
      toolResults: {},
      toolNames: [],
      inputTokens: inTok,
      outputTokens: outTok,
    };
  }

  const toolResults: Record<string, unknown> = {};
  const toolNames: string[] = [];
  for (const req of plan1.toolRequests.slice(0, 4)) {
    const started = Date.now();
    const res = await runCapability(params.capCtx, req.tool, req.args);
    toolNames.push(req.tool);
    await recordToolCall({
      aiRunId: params.aiRunId,
      organizationId: params.capCtx.organizationId,
      toolName: req.tool,
      status: res.ok ? "OK" : res.code === "FORBIDDEN" ? "DENIED" : "ERROR",
      inputSummary: JSON.stringify(req.args).slice(0, 300),
      outputSummary: res.ok
        ? JSON.stringify(res.data).slice(0, 300)
        : `${res.code}: ${res.message}`,
      durationMs: Date.now() - started,
    });
    toolResults[req.tool] = res.ok
      ? res.data
      : { error: res.code, message: res.message };
  }

  const pass2 = await provider.generateStructured({
    system: params.system,
    messages: [
      ...params.conversation,
      {
        role: "user",
        content: `[RESULTATS OUTILS] ${JSON.stringify(toolResults)}`,
      },
    ],
  });
  const plan2 = safeParseTurnPlan(pass2.raw);
  inTok = sumTok(inTok, pass2.inputTokens);
  outTok = sumTok(outTok, pass2.outputTokens);

  return {
    plan: plan2,
    toolResults,
    toolNames,
    inputTokens: inTok,
    outputTokens: outTok,
  };
}

function sumTok(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}
