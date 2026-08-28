import "server-only";
import type { LanguageCode, LanguageScope, Prisma } from "@prisma/client";
import { lcDb } from "../db";
import { sanitizeLearningData } from "../sanitize";
import { lcAudit } from "../audit";

/**
 * Construit un dataset d'apprentissage — UNIQUEMENT des candidats APPROVED ou
 * PROMOTED, `shareable = true`, texte ré-anonymisé. Prêt pour une évaluation
 * ASR / LLM future (§29–§32). AUCUN entraînement ici.
 */

export type DatasetFormat = "jsonl" | "csv";

export type DatasetFilters = {
  format: DatasetFormat;
  language?: LanguageCode | null;
  domainCode?: string | null;
  scope?: LanguageScope | null;
  /** APPROVED | PROMOTED (défaut : les deux) */
  status?: "APPROVED" | "PROMOTED" | null;
  includeSplit?: boolean;
};

export type DatasetRow = {
  originalPattern: string | null;
  text: string;
  language: LanguageCode;
  canonical: string;
  meaning: string | null;
  domain: string | null;
  scope: LanguageScope;
  intent: string | null;
  candidateType: string;
  occurrenceCount: number;
  split?: string;
};

export async function buildLearningDataset(
  filters: DatasetFilters,
  actorRef?: string | null,
): Promise<{ contentType: string; body: string; count: number }> {
  const where: Prisma.LearningCandidateWhereInput = {
    shareable: true,
    status: filters.status ? filters.status : { in: ["APPROVED", "PROMOTED"] },
    ...(filters.language ? { language: filters.language } : {}),
    ...(filters.domainCode ? { domainCode: filters.domainCode } : {}),
    ...(filters.scope ? { scopeSuggestion: filters.scope } : {}),
  };

  const candidates = await lcDb.learningCandidate.findMany({
    where,
    orderBy: [{ language: "asc" }, { normalizedText: "asc" }],
    take: 50_000,
  });

  const rows: DatasetRow[] = candidates.map((c) => {
    const canonical = sanitizeLearningData(c.canonicalText).text;
    return {
      originalPattern: c.originalPattern ? sanitizeLearningData(c.originalPattern).text : null,
      text: sanitizeLearningData(c.normalizedText).text,
      language: c.language,
      canonical,
      meaning: c.proposedMeaning ? sanitizeLearningData(c.proposedMeaning).text : null,
      domain: c.domainCode,
      scope: c.scopeSuggestion,
      intent: c.proposedIntentCode,
      candidateType: c.candidateType,
      occurrenceCount: c.occurrenceCount,
      ...(filters.includeSplit ? { split: c.datasetSplit ?? "TRAIN" } : {}),
    };
  });

  await lcAudit({
    action: "LEARNING_DATASET_EXPORTED",
    entityType: "learning_dataset",
    actorRef: actorRef ?? null,
    metadata: { format: filters.format, count: rows.length },
  });

  if (filters.format === "csv") {
    const head =
      "originalPattern,text,language,canonical,meaning,domain,scope,intent,candidateType,occurrenceCount" +
      (filters.includeSplit ? ",split" : "");
    const esc = (v: unknown) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`);
    const lines = rows.map((r) =>
      [
        r.originalPattern, r.text, r.language, r.canonical, r.meaning, r.domain,
        r.scope, r.intent, r.candidateType, r.occurrenceCount,
        ...(filters.includeSplit ? [r.split] : []),
      ].map(esc).join(","),
    );
    return { contentType: "text/csv", body: [head, ...lines].join("\n"), count: rows.length };
  }
  return {
    contentType: "application/x-ndjson",
    body: rows.map((r) => JSON.stringify(r)).join("\n"),
    count: rows.length,
  };
}
