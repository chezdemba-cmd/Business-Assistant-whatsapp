/**
 * Logger structuré — sûr côté serveur et edge, sans dépendance.
 *
 * Émet une ligne JSON par événement : `{ ts, level, service, event, requestId?,
 * organizationId?, ...fields }`. Ne JAMAIS y passer de secret ni de PII
 * (numéros clients, contenu de messages, tokens). Les champs sont filtrés par
 * une liste de clés interdites en dernier recours.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return LEVELS[(raw as LogLevel)] ?? LEVELS.info;
}

const REDACT_KEYS = /(token|secret|password|authorization|apikey|api_key|cookie)/i;

export type LogFields = Record<string, unknown> & {
  service?: string;
  event?: string;
  requestId?: string;
  organizationId?: string;
};

function sanitize(fields: LogFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT_KEYS.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v instanceof Error) {
      out[k] = { name: v.name, message: v.message };
      continue;
    }
    if (typeof v === "string" && v.length > 500) {
      out[k] = `${v.slice(0, 500)}…`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (LEVELS[level] < threshold()) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...sanitize(fields),
  });
  // eslint-disable-next-line no-console
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(line);
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
  /** Sous-logger avec des champs par défaut (service, requestId…). */
  child(base: LogFields) {
    return {
      debug: (msg: string, f?: LogFields) => emit("debug", msg, { ...base, ...f }),
      info: (msg: string, f?: LogFields) => emit("info", msg, { ...base, ...f }),
      warn: (msg: string, f?: LogFields) => emit("warn", msg, { ...base, ...f }),
      error: (msg: string, f?: LogFields) => emit("error", msg, { ...base, ...f }),
    };
  },
};

/** Identifiant de requête court (corrélation logs / erreurs). */
export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
