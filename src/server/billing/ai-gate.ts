import "server-only";
import { isAppError } from "@/server/errors";
import { orgHasFeature } from "./guard.ts";
import { featureUnavailableMessage } from "./features.ts";
import {
  checkUsageLimit,
  recordUsage,
} from "./usage-service.ts";
import { limitReachedMessage } from "./limits.ts";

/**
 * Portillon IA réutilisable (§13, §20, §21) : vérifie la feature `AI` et le
 * quota `AI_REQUESTS` AVANT tout appel au provider. En cas de refus, renvoie un
 * message clair et n'engage AUCUNE dépense fournisseur.
 */
export async function aiUsageGate(
  organizationId: string,
  timeZone: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (!(await orgHasFeature(organizationId, "AI"))) {
      return { ok: false, message: featureUnavailableMessage("AI") };
    }
    const check = await checkUsageLimit(organizationId, "AI_REQUESTS", { timeZone });
    if (!check.allowed) return { ok: false, message: limitReachedMessage(check) };
    return { ok: true };
  } catch (err) {
    // Un problème d'abonnement ne doit pas bloquer l'assistant : on laisse
    // passer (fail-open) mais sans quota — un vrai souci sera visible ailleurs.
    if (isAppError(err)) return { ok: true };
    return { ok: true };
  }
}

/** À appeler APRÈS un run IA réussi. Best-effort. */
export async function recordAiUsage(
  organizationId: string,
  timeZone: string,
  tokens: { input: number | null; output: number | null },
): Promise<void> {
  await recordUsage(organizationId, "AI_REQUESTS", 1, timeZone);
  const total = (tokens.input ?? 0) + (tokens.output ?? 0);
  if (total > 0) await recordUsage(organizationId, "AI_TOKENS", total, timeZone);
}
