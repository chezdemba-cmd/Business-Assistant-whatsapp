import { NextResponse, type NextRequest } from "next/server";
import type { LanguageCode, LanguageScope, LearningCandidateStatus, LearningCandidateType } from "@prisma/client";
import { requireClient } from "@/language-core/api-helpers";
import { listCandidates } from "@/language-core/learning/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const gate = await requireClient(request, "language.read");
  if ("response" in gate) return gate.response;
  const p = request.nextUrl.searchParams;

  const rows = await listCandidates({
    language: (p.get("language") as LanguageCode) || undefined,
    domainCode: p.get("domain") || undefined,
    scope: (p.get("scope") as LanguageScope) || undefined,
    type: (p.get("type") as LearningCandidateType) || undefined,
    status: (p.get("status") as LearningCandidateStatus) || undefined,
    minScore: p.get("minScore") ? Number(p.get("minScore")) : undefined,
    limit: p.get("limit") ? Number(p.get("limit")) : undefined,
  });

  return NextResponse.json({
    count: rows.length,
    candidates: rows.map((c) => ({
      id: c.id,
      candidateType: c.candidateType,
      language: c.language,
      scopeSuggestion: c.scopeSuggestion,
      domainCode: c.domainCode,
      canonicalText: c.canonicalText,
      originalPattern: c.originalPattern,
      occurrenceCount: c.occurrenceCount,
      organizationCount: c.organizationCount,
      correctionCount: c.correctionCount,
      sourceCount: c.sourceCount,
      confidenceScore: c.confidenceScore,
      shareable: c.shareable,
      stale: c.stale,
      status: c.status,
      lastSeenAt: c.lastSeenAt,
    })),
  });
}
