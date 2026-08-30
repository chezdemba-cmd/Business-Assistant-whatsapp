import "server-only";
import { getEnv } from "@/lib/env";
import { setExceptionSink } from "@/server/errors";
import { logger } from "@/lib/logger";

/**
 * Suivi d'erreurs (§25). Point d'ancrage prêt à recevoir Sentry (ou équivalent).
 *
 * Tant que `@sentry/node` (ou un autre SDK) n'est PAS installé, il n'y a AUCUN
 * récepteur d'exceptions : les erreurs sont uniquement journalisées en JSON
 * structuré (`level:error`) par `logError()` — la plateforme d'hébergement peut
 * les ingérer. On ne branche pas de sink « qui ne fait que re-logger » : cela
 * doublerait chaque ligne d'erreur sans rien apporter.
 *
 * Pour activer un vrai suivi : ajouter `@sentry/node`, puis dans ce fichier
 *   import * as Sentry from "@sentry/node";
 *   Sentry.init({ dsn });
 *   setExceptionSink((context, error, fields) =>
 *     Sentry.captureException(error, { tags: { context }, extra: fields }));
 * `hasExceptionSink()` (src/server/errors.ts) passera alors à `true` et
 * `/api/health` rapportera `errorTracking: "active"`.
 *
 * À appeler une fois au démarrage (layout racine serveur, worker).
 */
let installed = false;

export function installErrorTracking(): void {
  if (installed) return;
  installed = true;

  const dsn = getEnv().SENTRY_DSN;
  if (!dsn) return;

  // DSN fourni mais aucun SDK câblé : on le signale UNE fois, sans installer de
  // sink redondant. Les erreurs restent visibles via les logs structurés.
  logger.warn("errorTracking.dsnWithoutSdk", {
    service: "error-tracking",
    event: "dsn_set_no_sdk",
    hint: "Ajouter @sentry/node et brancher setExceptionSink() pour capturer réellement les exceptions.",
  });
}
