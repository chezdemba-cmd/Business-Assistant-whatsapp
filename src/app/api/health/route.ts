import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getEnv } from "@/lib/env";
import { hasExceptionSink } from "@/server/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Santé de l'application (§26). Ne révèle AUCUN secret : uniquement des
 * booléens et des noms de provider. `200` si la base répond, `503` sinon.
 */
export async function GET() {
  const env = getEnv();

  let db = false;
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    db = true;
  } catch {
    db = false;
  }

  // Jobs bloqués (verrouillés depuis > 10 min) — indice de worker en panne.
  let stuckJobs = 0;
  try {
    stuckJobs = await prisma.job.count({
      where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - 600_000) } },
    });
  } catch {
    /* ignore */
  }

  const ok = db;
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      time: new Date().toISOString(),
      appEnv: env.APP_ENV,
      db,
      dbLatencyMs,
      queue: { store: "db", stuckJobs },
      rateLimitStore: env.RATE_LIMIT_STORE,
      providers: {
        whatsapp: env.WHATSAPP_PROVIDER,
        ai: env.AI_PROVIDER,
        voice: env.VOICE_PROVIDER,
        billing: env.BILLING_PROVIDER,
      },
      // "active" = un SDK capture réellement ; "dsn-set-no-sdk" = DSN fourni
      // mais aucun récepteur branché (erreurs en logs seulement) ; "logs-only".
      errorTracking: hasExceptionSink()
        ? "active"
        : env.SENTRY_DSN
          ? "dsn-set-no-sdk"
          : "logs-only",
    },
    { status: ok ? 200 : 503 },
  );
}
