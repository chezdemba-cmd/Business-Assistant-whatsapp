import { type NextRequest } from "next/server";
import type { LanguageCode, LanguageScope } from "@prisma/client";
import { apiError, requireClient } from "@/language-core/api-helpers";
import { buildExport, type ExportFormat } from "@/language-core/export-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/v1/language/exports?format=json|jsonl|csv&language=&domain=&scope=
 * Défaut : GLOBAL + DOMAIN, VALIDATED, sans PII. ORGANIZATION exige
 * `language.organization.read` + `organizationId`.
 */
export async function GET(request: NextRequest) {
  const gate = await requireClient(request, "language.export");
  if ("response" in gate) return gate.response;
  const { client } = gate;
  const p = request.nextUrl.searchParams;

  const format = (p.get("format") ?? "json") as ExportFormat;
  if (!["json", "jsonl", "csv"].includes(format)) {
    return apiError(400, "BAD_REQUEST", "format ∈ {json, jsonl, csv}.");
  }

  const requestedScopes = (p.get("scope")?.split(",") ?? []).filter(Boolean) as LanguageScope[];
  const scopes = requestedScopes.length
    ? requestedScopes.filter((s) => client.allowedScopes.includes(s))
    : (["GLOBAL", "DOMAIN"] as LanguageScope[]);

  const allowOrg = client.permissions.includes("language.organization.read");
  const organizationId = p.get("organizationId");
  if (scopes.includes("ORGANIZATION") && (!allowOrg || !organizationId)) {
    return apiError(403, "FORBIDDEN", "Export ORGANIZATION : permission + organizationId requis.");
  }

  try {
    const out = await buildExport(
      {
        format,
        language: (p.get("language") as LanguageCode) ?? null,
        domainCode: p.get("domain"),
        scopes,
        organizationId,
        allowOrganization: allowOrg,
      },
      `app:${client.applicationCode}`,
    );
    return new Response(out.body, {
      status: 200,
      headers: {
        "content-type": out.contentType,
        "x-record-count": String(out.count),
        "content-disposition": `attachment; filename="djeli-language-${format}.${format === "csv" ? "csv" : format === "jsonl" ? "jsonl" : "json"}"`,
      },
    });
  } catch (e) {
    return apiError(400, "BAD_REQUEST", e instanceof Error ? e.message : "Export impossible.");
  }
}
