import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { secretsMatch } from "@/lib/secret-compare";
import { runMaintenance } from "@/server/maintenance/cleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tâches d'entretien (§10). Même secret que les autres routes internes. */
export async function POST(request: NextRequest) {
  const secret = getEnv().AUTOMATION_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "AUTOMATION_CRON_SECRET non configuré." }, { status: 503 });
  }
  if (!secretsMatch(request.headers.get("x-automation-secret"), secret)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const result = await runMaintenance();
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
