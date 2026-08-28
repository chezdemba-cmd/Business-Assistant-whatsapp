import "server-only";
import { z } from "zod";
import {
  isAppError,
  logError,
  toUserMessage,
} from "@/server/errors";
import { fail, ok, type ActionResult } from "@/lib/result";

/**
 * Enveloppe commune des Server Actions :
 *  - ZodError        -> { ok:false, fieldErrors }
 *  - AppError        -> { ok:false, error: userMessage, code }
 *  - autre           -> log dev + message générique (jamais d'erreur SQL brute)
 *
 * Ne pas utiliser autour d'un `redirect()` — celui-ci jette un signal Next
 * qui doit remonter. Faire les redirections côté client à partir du résultat.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "_";
        if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
      }
      return fail("Certains champs sont invalides.", {
        fieldErrors,
        code: "VALIDATION",
      });
    }
    if (isAppError(error)) {
      return fail(error.userMessage, { code: error.code });
    }
    logError("server-action", error);
    return fail(toUserMessage(error), { code: "INTERNAL" });
  }
}

/** Transforme un FormData plat en objet string→string. */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
