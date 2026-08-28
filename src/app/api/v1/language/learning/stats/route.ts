import { NextResponse, type NextRequest } from "next/server";
import { requireClient } from "@/language-core/api-helpers";
import { learningDashboardStats } from "@/language-core/learning/metrics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const gate = await requireClient(request, "language.read");
  if ("response" in gate) return gate.response;
  return NextResponse.json(await learningDashboardStats());
}
