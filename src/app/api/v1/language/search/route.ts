import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJson, requireClient } from "@/language-core/api-helpers";
import { searchEntries } from "@/language-core/search-service";
import type { LanguageCode } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  query?: string;
  language?: string;
  domain?: string;
  organizationId?: string;
  limit?: number;
};

export async function POST(request: NextRequest) {
  const gate = await requireClient(request, "language.read");
  if ("response" in gate) return gate.response;
  const { client } = gate;

  const body = await readJson<Body>(request);
  if (!body?.query) return apiError(400, "BAD_REQUEST", "Champ « query » requis.");

  const orgId =
    body.organizationId && client.permissions.includes("language.organization.read")
      ? body.organizationId
      : null;

  const rows = await searchEntries({
    query: body.query,
    language: (body.language as LanguageCode) ?? null,
    domainCode: body.domain ?? null,
    organizationId: orgId,
    allowedScopes: client.allowedScopes,
    limit: body.limit,
  });

  return NextResponse.json(
    {
      count: rows.length,
      results: rows.map((e) => ({
        id: e.id,
        canonicalText: e.canonicalText,
        language: e.language,
        scope: e.scope,
        domainCode: e.domainCode,
        meaning: e.meaning,
        status: e.status,
        variants: e.variants.map((v) => v.text),
        translations: e.translations.map((t) => ({ language: t.language, text: t.text })),
        intents: e.intentMappings.map((m) => m.intentCode),
      })),
    },
    { status: 200 },
  );
}
