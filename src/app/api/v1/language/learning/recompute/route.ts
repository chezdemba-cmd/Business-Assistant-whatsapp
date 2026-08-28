import { NextResponse, type NextRequest } from "next/server";
import { requireClient } from "@/language-core/api-helpers";
import { recomputeLearningCandidates } from "@/language-core/learning/aggregator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/v1/language/learning/recompute — idempotent (§19, §54). */
export async function POST(request: NextRequest) {
  const gate = await requireClient(request, "language.review");
  if ("response" in gate) return gate.response;
  const res = await recomputeLearningCandidates(`app:${gate.client.applicationCode}`);
  return NextResponse.json(res, { status: 200 });
}
