import "server-only";
import { getEnv } from "@/lib/env";
import { setExceptionSink } from "@/server/errors";
import { logger } from "@/lib/logger";

/**
 * Suivi d'erreurs (§25). Prêt à recevoir Sentry (ou équivalent) : si
 * `SENTRY_DSN` est défini et le SDK installé, brancher ici `Sentry.init` +
 * `Sentry.captureException`. Sans SDK, on se contente d'un log structuré
 * `level:error` que la plateforme d'hébergement peut ingérer.
 *
 * À appeler une fois au démarrage (layout racine serveur, worker).
 */
let installed = false;

export function installErrorTracking(): void {
  if (installed) return;
  installed = true;

  const dsn = getEnv().SENTRY_DSN;
  if (!dsn) return;

  setExceptionSink((context, error, fields) => {
    // Remplacer par Sentry.captureException(error, { tags: { context }, extra: fields })
    // une fois `@sentry/node` ajouté aux dépendances.
    logger.error("exception.captured", {
      service: "error-tracking",
      event: context,
      dsnConfigured: true,
      errName: error instanceof Error ? error.name : "unknown",
      ...(fields ?? {}),
    });
  });
}
