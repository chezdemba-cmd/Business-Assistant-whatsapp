import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { registerAllJobHandlers } from "@/server/jobs/handlers";
import { runPendingJobs } from "@/server/jobs/queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Traite un lot de jobs prêts (§32-35). Même secret que les automatisations. */
export async function POST(request: NextRequest) {
  const secret = getEnv().AUTOMATION_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "AUTOMATION_CRON_SECRET non configuré." },
      { status: 503 },
    );
  }
  if (request.headers.get("x-automation-secret") !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  registerAllJobHandlers();
  const limitRaw = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, limitRaw) : 50;
  const result = await runPendingJobs(limit);
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
