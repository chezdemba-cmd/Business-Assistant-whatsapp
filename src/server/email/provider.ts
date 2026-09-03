import "server-only";
import { getEnv } from "@/lib/env";
import { logError } from "@/server/errors";
import type { EmailProvider } from "./provider-types";
import { MockEmailProvider } from "./mock-provider";
import { ResendEmailProvider } from "./resend-provider";

export type { EmailMessage, EmailProvider, EmailSendResult } from "./provider-types";

let cached: EmailProvider | null = null;

/**
 * Fabrique du provider e-mail. `getEnv()` bloque déjà le démarrage en production
 * si EMAIL_PROVIDER=mock sans EMAIL_ALLOW_MOCK_IN_PROD=1, ou si `resend` sans clé.
 */
export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const env = getEnv();
  if (env.EMAIL_PROVIDER === "resend" && env.EMAIL_API_KEY) {
    cached = new ResendEmailProvider({ apiKey: env.EMAIL_API_KEY, from: env.EMAIL_FROM });
    return cached;
  }
  if (env.EMAIL_PROVIDER === "resend") {
    logError("email.provider.fallbackToMock", { reason: "EMAIL_API_KEY manquant" });
  }
  cached = new MockEmailProvider();
  return cached;
}

export function __setEmailProviderForTests(p: EmailProvider | null): void {
  cached = p;
}
