import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { getEnv, inspectEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Readiness pour le déploiement (§27) : l'instance est-elle prête à recevoir du
 * trafic ? Vérifie la config (garde-fous de production) + la connectivité DB +
 * l'application des migrations (présence de tables clés). `200` = prêt.
 */
export async function GET() {
  const checks: Record<string, boolean> = {};

  const env = inspectEnv();
  checks.env = env.ok;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    // Table introduite en Phase 8 : si absente, les migrations ne sont pas à jour.
    await prisma.plan.count();
    checks.migrations = true;
  } catch {
    checks.migrations = false;
  }

  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json(
    {
      ready,
      appEnv: getEnv().APP_ENV,
      checks,
      ...(env.ok ? {} : { envIssues: env.issues }),
    },
    { status: ready ? 200 : 503 },
  );
}
