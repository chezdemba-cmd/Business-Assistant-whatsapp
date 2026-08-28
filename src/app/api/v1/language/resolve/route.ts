import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireClient } from "@/language-core/api-helpers";
import { resolveExpression } from "@/language-core/resolve-engine";
import type { LanguageCode } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  text?: string;
  language?: string;
  domain?: string;
  organizationId?: string;
  context?: string;
};

/** POST /api/v1/language/resolve — cœur de la Language API. */
export async function POST(request: NextRequest) {
  const gate = await requireClient(request, "language.read");
  if ("response" in gate) return gate.response;
  const { client } = gate;

  const body = await readJson<Body>(request);
  if (!body?.text) return apiError(400, "BAD_REQUEST", "Champ « text » requis.");

  // domain doit être autorisé pour cette application (si demandé)
  if (
    body.domain &&
    client.allowedDomains.length > 0 &&
    !client.allowedDomains.includes(body.domain)
  ) {
    return apiError(403, "FORBIDDEN", "Domaine non autorisé pour cette application.");
  }
  // organizationId → nécessite la permission organization.read
  const orgId =
    body.organizationId && client.permissions.includes("language.organization.read")
      ? body.organizationId
      : null;

  const result = await resolveExpression({
    text: body.text,
    language: (body.language as LanguageCode) ?? null,
    domainCode: body.domain ?? null,
    organizationId: orgId,
    context: body.context ?? null,
    applicationCode: client.applicationCode,
    ctx: {
      organizationId: orgId,
      domainCode: body.domain ?? null,
      allowedScopes: client.allowedScopes,
    },
  });

  return NextResponse.json(result, { status: 200 });
}
