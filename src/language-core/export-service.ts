import "server-only";
import type { LanguageCode, LanguageScope, Prisma } from "@prisma/client";
import { lcDb } from "./db";
import { sanitizeLearningData } from "./sanitize";
import { lcAudit } from "./audit";

/**
 * Export du corpus. Par défaut : GLOBAL + DOMAIN, statut VALIDATED uniquement,
 * SANS PII, SANS observations brutes, SANS données ORGANIZATION. L'export de
 * données ORGANIZATION exige `language.organization.read` + un `organizationId`.
 */

export type ExportFormat = "json" | "jsonl" | "csv";

export type ExportFilters = {
  format: ExportFormat;
  language?: LanguageCode | null;
  domainCode?: string | null;
  scopes?: LanguageScope[];
  organizationId?: string | null;
  /** true seulement si le client a la permission organization.read. */
  allowOrganization?: boolean;
};

export type ExportRow = {
  text: string;
  language: LanguageCode;
  canonical: string;
  meaning: string | null;
  domain: string | null;
  scope: LanguageScope;
  intent: string | null;
  frenchTranslation: string | null;
};

export async function buildExport(
  filters: ExportFilters,
  actorRef?: string | null,
): Promise<{ contentType: string; body: string; count: number }> {
  const scopes: LanguageScope[] =
    filters.scopes && filters.scopes.length
      ? filters.scopes
      : ["GLOBAL", "DOMAIN"];

  const where: Prisma.LanguageEntryWhereInput = {
    status: "VALIDATED",
    archivedAt: null,
    scope: { in: scopes },
    ...(filters.language ? { language: filters.language } : {}),
    ...(filters.domainCode ? { domainCode: filters.domainCode } : {}),
  };

  if (scopes.includes("ORGANIZATION")) {
    if (!filters.allowOrganization || !filters.organizationId) {
      throw new Error("Export ORGANIZATION : permission + organizationId requis.");
    }
    where.OR = [
      { scope: { in: scopes.filter((s) => s !== "ORGANIZATION") } },
      { scope: "ORGANIZATION", organizationId: filters.organizationId },
    ];
    delete where.scope;
  }

  const entries = await lcDb.languageEntry.findMany({
    where,
    orderBy: [{ language: "asc" }, { normalizedText: "asc" }],
    include: { intentMappings: { where: { status: "VALIDATED" } } },
    take: 50_000,
  });

  const rows: ExportRow[] = entries.map((e) => {
    const canonical = sanitizeLearningData(e.canonicalText).text;
    return {
      text: sanitizeLearningData(e.normalizedText).text,
      language: e.language,
      canonical,
      meaning: e.meaning ? sanitizeLearningData(e.meaning).text : null,
      domain: e.domainCode,
      scope: e.scope,
      intent: e.intentMappings[0]?.intentCode ?? null,
      frenchTranslation: e.frenchTranslation
        ? sanitizeLearningData(e.frenchTranslation).text
        : null,
    };
  });

  await lcAudit({
    action: "EXPORT_CREATED",
    entityType: "language_export",
    actorRef: actorRef ?? null,
    metadata: { format: filters.format, count: rows.length, scopes },
  });

  if (filters.format === "jsonl") {
    return {
      contentType: "application/x-ndjson",
      body: rows.map((r) => JSON.stringify(r)).join("\n"),
      count: rows.length,
    };
  }
  if (filters.format === "csv") {
    const head = "text,language,canonical,meaning,domain,scope,intent,frenchTranslation";
    const esc = (v: string | null) =>
      v == null ? "" : `"${v.replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [r.text, r.language, r.canonical, r.meaning, r.domain, r.scope, r.intent, r.frenchTranslation]
        .map((v) => esc(v == null ? null : String(v)))
        .join(","),
    );
    return { contentType: "text/csv", body: [head, ...lines].join("\n"), count: rows.length };
  }
  return {
    contentType: "application/json",
    body: JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, rows }, null, 2),
    count: rows.length,
  };
}
