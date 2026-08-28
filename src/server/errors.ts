/**
 * Erreurs applicatives. Chaque erreur porte :
 *  - `userMessage` : phrase montrable à l'utilisateur (jamais de détail SQL) ;
 *  - `code` : identifiant stable pour le front / les logs.
 * Les logs développeur détaillés sont émis via `logError()`.
 */

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "ORGANIZATION_UNAVAILABLE"
  | "INVITATION_INVALID"
  | "INVITATION_EXPIRED"
  | "RATE_LIMITED"
  // Phase 8 — monétisation
  | "PLAN_LIMIT"
  | "FEATURE_LOCKED"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly userMessage: string;
  readonly status: number;

  constructor(
    code: AppErrorCode,
    userMessage: string,
    opts?: { status?: number; cause?: unknown },
  ) {
    super(userMessage, opts?.cause ? { cause: opts.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
    this.status = opts?.status ?? defaultStatus(code);
  }
}

function defaultStatus(code: AppErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION":
      return 422;
    case "CONFLICT":
      return 409;
    case "ORGANIZATION_UNAVAILABLE":
      return 409;
    case "INVITATION_INVALID":
    case "INVITATION_EXPIRED":
      return 410;
    case "RATE_LIMITED":
      return 429;
    case "PLAN_LIMIT":
      return 402;
    case "FEATURE_LOCKED":
      return 403;
    default:
      return 500;
  }
}

export const Unauthenticated = (msg = "Vous devez être connecté.") =>
  new AppError("UNAUTHENTICATED", msg);

export const Forbidden = (
  msg = "Vous n'avez pas la permission d'effectuer cette action.",
) => new AppError("FORBIDDEN", msg);

export const NotFound = (msg = "Ressource introuvable.") =>
  new AppError("NOT_FOUND", msg);

export const Conflict = (msg: string) => new AppError("CONFLICT", msg);

export const OrganizationUnavailable = (
  msg = "Cette entreprise n'est pas disponible.",
) => new AppError("ORGANIZATION_UNAVAILABLE", msg);

export const InvitationInvalid = (msg = "Cette invitation n'est pas valide.") =>
  new AppError("INVITATION_INVALID", msg);

export const InvitationExpired = (msg = "Cette invitation a expiré.") =>
  new AppError("INVITATION_EXPIRED", msg);

export const PlanLimit = (msg: string) => new AppError("PLAN_LIMIT", msg);

export const FeatureLocked = (msg: string) => new AppError("FEATURE_LOCKED", msg);

export const RateLimited = (msg = "Trop de tentatives. Réessayez dans un instant.") =>
  new AppError("RATE_LIMITED", msg);

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/**
 * Point d'ancrage pour une intégration de suivi d'erreurs (Sentry ou
 * équivalent). Enregistré au démarrage du process si `SENTRY_DSN` est défini
 * (cf. `src/server/observability/error-tracking.ts`). No-op par défaut.
 */
type ExceptionSink = (context: string, error: unknown, fields?: Record<string, unknown>) => void;
let exceptionSink: ExceptionSink | null = null;
export function setExceptionSink(sink: ExceptionSink | null): void {
  exceptionSink = sink;
}

/** Log développeur structuré — jamais montré à l'utilisateur, jamais de secret. */
export function logError(
  context: string,
  error: unknown,
  fields?: Record<string, unknown>,
): void {
  const payload =
    error instanceof Error
      ? { errName: error.name, errMessage: error.message }
      : { value: typeof error === "string" ? error : JSON.stringify(error) };
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      msg: context,
      ...payload,
      ...(fields ?? {}),
    }),
  );
  if (exceptionSink) {
    try {
      exceptionSink(context, error, fields);
    } catch {
      /* le suivi d'erreurs ne doit jamais casser le flux */
    }
  }
}

/** Traduit n'importe quelle erreur en message utilisateur sûr. */
export function toUserMessage(error: unknown): string {
  if (isAppError(error)) return error.userMessage;
  return "Une erreur inattendue est survenue. Réessayez dans un instant.";
}
