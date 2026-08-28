import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireClient } from "@/language-core/api-helpers";
import { getCandidate } from "@/language-core/learning/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireClient(request, "language.read");
  if ("response" in gate) return gate.response;
  const { id } = await params;

  const c = await getCandidate(id);
  if (!c) return apiError(404, "NOT_FOUND", "Candidat introuvable.");

  return NextResponse.json({
    ...c,
    // Preuves : jamais l'organizationId en clair — hashs seulement.
    evidence: c.evidence.map((e) => ({
      observationId: e.observationId,
      correctionId: e.correctionId,
      applicationCode: e.applicationCode,
      domainCode: e.domainCode,
      organizationHash: e.organizationHash,
      weight: e.weight,
      seenAt: e.seenAt,
    })),
  });
}
