import { NextResponse, type NextRequest } from "next/server";
import { requireClient } from "@/language-core/api-helpers";
import { lcDb } from "@/language-core/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const gate = await requireClient(request, "language.read");
  if ("response" in gate) return gate.response;

  const domains = await lcDb.languageDomain.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
    select: { code: true, name: true, description: true },
  });
  // Restreint aux domaines autorisés si l'application en déclare.
  const allowed = gate.client.allowedDomains;
  const filtered = allowed.length ? domains.filter((d) => allowed.includes(d.code)) : domains;
  return NextResponse.json({ count: filtered.length, domains: filtered });
}
