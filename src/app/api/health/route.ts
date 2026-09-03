import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Santé de l'application (§26). Réponse MINIMALE par défaut (status / db) pour
 * les sondes externes. Les détails d'exploitation (providers, latence, jobs
 * bloqués, stores) ne sont exposés qu'à un appelant présentant
 * `x-automation-secret` (secret des routes internes). `200` si la base répond,
 * `503` sinon — dans tous les cas.
 */
export async function GET(request: NextRequest) {
  const env = getEnv();
  const trusted =
    !!env.AUTOMATION_CRON_SECRET &&
    request.headers.get("x-automation-secret") === env.AUTOMATION_CRON_SECRET;

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
  // Interrogé uniquement pour un appelant de confiance.
  let stuckJobs = 0;
  if (trusted) {
    try {
      stuckJobs = await prisma.job.count({
        where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - 600_000) } },
      });
    } catch {
      /* ignore */
    }
  }

  const ok = db;
  const status = ok ? 200 : 503;

  if (!trusted) {
    return NextResponse.json(
      { status: ok ? "ok" : "degraded", time: new Date().toISOString(), db },
      { status },
    );
  }

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
      errorTracking: env.SENTRY_DSN ? "configured" : "none",
    },
    { status },
  );
}
