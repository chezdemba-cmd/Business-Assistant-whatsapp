import "server-only";
import type { LanguageCode, LearningCandidateType, Prisma } from "@prisma/client";
import { lcDb } from "../db";
import { getEnv } from "@/lib/env";
import { normalizeText } from "../normalize";
import { sanitizeLearningData } from "../sanitize";
import { lcAudit } from "../audit";
import { calculateCandidateScore, explainScore } from "./scoring";
import { suggestScope } from "./scope-suggestion";
import { candidateDedupeKey, organizationHash } from "./dedupe";
import { detectEntryConflict } from "./conflict";
import { CORRECTION_WEIGHT, OBSERVATION_WEIGHT, NO_MATCH_WEIGHT } from "./config";

/**
 * Agrégateur DÉTERMINISTE (aucun ML / embedding / vecteur, §6). Regroupe
 * observations et corrections en `LearningCandidate` idempotents (`dedupeKey`).
 * Ne PROMEUT rien : produit seulement de la matière à revue humaine.
 */

type Grp = {
  language: LanguageCode;
  original: string; // norme
  corrected: string | null; // norme (null = pure observation no-match)
  canonicalRaw: string; // texte brut pour la forme canonique proposée
  correctionIds: string[];
  observationIds: string[];
  orgIds: Set<string>;
  apps: Set<string>;
  domains: Set<string>;
  first: Date;
  last: Date;
  allShareable: boolean;
};

function thresholds() {
  const e = getEnv();
  return {
    minOccurrences: e.LEARNING_MIN_OCCURRENCES,
    minOrganizations: e.LEARNING_MIN_ORGANIZATIONS,
    minCorrections: e.LEARNING_MIN_CORRECTIONS,
    minConfidence: e.LEARNING_MIN_CONFIDENCE,
    staleDays: e.LEARNING_STALE_DAYS,
  };
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

function classify(originalNorm: string, correctedNorm: string | null): {
  type: LearningCandidateType;
  originalPattern: string | null;
} {
  if (!correctedNorm) return { type: "NEW_ENTRY", originalPattern: null };
  if (originalNorm === correctedNorm) return { type: "VARIANT", originalPattern: originalNorm };
  return tokenOverlap(originalNorm, correctedNorm) >= 0.6
    ? { type: "NORMALIZATION_PATTERN", originalPattern: originalNorm }
    : { type: "VARIANT", originalPattern: originalNorm };
}

export type RecomputeResult = {
  scannedCorrections: number;
  scannedObservations: number;
  candidatesCreated: number;
  candidatesUpdated: number;
  conflicts: number;
};

export async function recomputeLearningCandidates(
  actorRef?: string | null,
): Promise<RecomputeResult> {
  const t = thresholds();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - t.staleDays * 86_400_000);

  const [corrections, orphanObs] = await Promise.all([
    lcDb.languageCorrection.findMany({
      include: {
        observation: {
          select: {
            organizationId: true,
            applicationCode: true,
            domainCode: true,
          },
        },
      },
    }),
    lcDb.languageObservation.findMany({
      where: { resolvedMatchType: "NONE", corrections: { none: {} } },
      select: {
        id: true,
        organizationId: true,
        applicationCode: true,
        domainCode: true,
        originalText: true,
        detectedLanguage: true,
        createdAt: true,
      },
    }),
  ]);

  const groups = new Map<string, Grp>();
  const push = (
    key: string,
    seed: () => Grp,
    mut: (g: Grp) => void,
  ) => {
    let g = groups.get(key);
    if (!g) {
      g = seed();
      groups.set(key, g);
    }
    mut(g);
  };

  for (const c of corrections) {
    const on = normalizeText(c.originalText);
    const cn = normalizeText(c.correctedText);
    if (!on || !cn) continue;
    const key = `C|${c.detectedLanguage}|${on}=>${cn}`;
    push(
      key,
      () => ({
        language: c.detectedLanguage,
        original: on,
        corrected: cn,
        canonicalRaw: c.correctedText.trim(),
        correctionIds: [],
        observationIds: [],
        orgIds: new Set(),
        apps: new Set(),
        domains: new Set(),
        first: c.createdAt,
        last: c.createdAt,
        allShareable: true,
      }),
      (g) => {
        g.correctionIds.push(c.id);
        if (c.observation.organizationId) g.orgIds.add(c.observation.organizationId);
        g.apps.add(c.observation.applicationCode);
        if (c.observation.domainCode) g.domains.add(c.observation.domainCode);
        if (c.createdAt < g.first) g.first = c.createdAt;
        if (c.createdAt > g.last) g.last = c.createdAt;
        const ok =
          c.sanitizedText != null &&
          (c.consentStatus === "GRANTED" || c.consentStatus === "NOT_REQUIRED");
        if (!ok) g.allShareable = false;
      },
    );
  }

  for (const o of orphanObs) {
    const on = normalizeText(o.originalText);
    if (!on) continue;
    const key = `O|${o.detectedLanguage}|${on}`;
    push(
      key,
      () => ({
        language: o.detectedLanguage,
        original: on,
        corrected: null,
        canonicalRaw: o.originalText.trim(),
        correctionIds: [],
        observationIds: [],
        orgIds: new Set(),
        apps: new Set(),
        domains: new Set(),
        first: o.createdAt,
        last: o.createdAt,
        allShareable: !sanitizeLearningData(o.originalText).residualRisk,
      }),
      (g) => {
        g.observationIds.push(o.id);
        if (o.organizationId) g.orgIds.add(o.organizationId);
        g.apps.add(o.applicationCode);
        if (o.domainCode) g.domains.add(o.domainCode);
        if (o.createdAt < g.first) g.first = o.createdAt;
        if (o.createdAt > g.last) g.last = o.createdAt;
      },
    );
  }

  const res: RecomputeResult = {
    scannedCorrections: corrections.length,
    scannedObservations: orphanObs.length,
    candidatesCreated: 0,
    candidatesUpdated: 0,
    conflicts: 0,
  };

  for (const g of groups.values()) {
    const correctionCount = g.correctionIds.length;
    const occurrenceCount = correctionCount + g.observationIds.length;
    if (occurrenceCount < 2) continue; // bruit : au moins 2 signaux

    const organizationCount = g.orgIds.size;
    const sourceCount = g.apps.size;
    const domainCount = g.domains.size;

    const score = calculateCandidateScore({
      occurrenceCount,
      correctionCount,
      organizationCount,
      sourceCount,
      lastSeenAt: g.last,
      now,
    });

    const scopeSug = suggestScope({
      organizationCount,
      domainCount: Math.max(1, domainCount),
      occurrenceCount,
      correctionCount,
      confidenceScore: score,
      shareable: g.allShareable,
      thresholds: t,
    });

    const { type, originalPattern } = classify(g.original, g.corrected);
    const orgIdForScope =
      scopeSug.scope === "ORGANIZATION" && organizationCount === 1
        ? [...g.orgIds][0] ?? null
        : null;
    const domainForScope = scopeSug.scope === "DOMAIN" ? [...g.domains][0] ?? null : null;

    const dedupeKey = candidateDedupeKey({
      normalizedText: g.original,
      language: g.language,
      candidateType: type,
      domainCode: domainForScope,
      scopeSuggestion: scopeSug.scope,
      organizationId: orgIdForScope,
    });

    const conflict = await detectEntryConflict({
      normalizedText: normalizeText(g.canonicalRaw),
      language: g.language,
      scope: scopeSug.scope,
      domainCode: domainForScope,
      organizationId: orgIdForScope,
    });
    if (conflict.conflict) res.conflicts += 1;

    const evidenceSummary = {
      factors: explainScore({
        occurrenceCount,
        correctionCount,
        organizationCount,
        sourceCount,
        lastSeenAt: g.last,
        now,
      }),
      stats: { occurrenceCount, correctionCount, organizationCount, sourceCount, domainCount },
      domains: [...g.domains],
      applications: [...g.apps],
      scopeReason: scopeSug.reason,
      requiresStrongReview: scopeSug.requiresStrongReview,
      firstSeenAt: g.first.toISOString(),
      lastSeenAt: g.last.toISOString(),
    } satisfies Prisma.InputJsonValue;

    const readyForReview = correctionCount >= t.minCorrections || occurrenceCount >= t.minOccurrences;
    const baseStatus = conflict.conflict
      ? "CONFLICT"
      : readyForReview
        ? "REVIEW_PENDING"
        : "NEW";

    const existing = await lcDb.learningCandidate.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });

    const HUMAN_DECIDED = ["APPROVED", "REJECTED", "PROMOTED", "IGNORED", "ARCHIVED"];
    const nextStatus =
      existing && HUMAN_DECIDED.includes(existing.status)
        ? existing.status
        : baseStatus;

    const data = {
      language: g.language,
      domainCode: domainForScope,
      scopeSuggestion: scopeSug.scope,
      organizationId: orgIdForScope,
      candidateType: type,
      canonicalText: g.canonicalRaw,
      normalizedText: normalizeText(g.canonicalRaw),
      originalPattern: originalPattern,
      occurrenceCount,
      organizationCount,
      correctionCount,
      sourceCount,
      confidenceScore: score,
      shareable: g.allShareable,
      stale: g.last < staleBefore,
      status: nextStatus as never,
      evidenceSummary,
      conflictEntryId: conflict.entryId,
      firstSeenAt: g.first,
      lastSeenAt: g.last,
    };

    const candidate = await lcDb.learningCandidate.upsert({
      where: { dedupeKey },
      create: { dedupeKey, ...data },
      update: data,
      select: { id: true },
    });
    if (existing) res.candidatesUpdated += 1;
    else res.candidatesCreated += 1;

    // Reconstruit les preuves (anonymisées) — idempotent.
    await lcDb.learningEvidence.deleteMany({ where: { candidateId: candidate.id } });
    const evidenceRows: Prisma.LearningEvidenceCreateManyInput[] = [];
    for (const cid of g.correctionIds) {
      evidenceRows.push({
        candidateId: candidate.id,
        correctionId: cid,
        detectedLanguage: g.language,
        weight: CORRECTION_WEIGHT,
        seenAt: g.last,
      });
    }
    for (const oid of g.observationIds) {
      evidenceRows.push({
        candidateId: candidate.id,
        observationId: oid,
        detectedLanguage: g.language,
        weight: g.corrected ? OBSERVATION_WEIGHT : NO_MATCH_WEIGHT,
        seenAt: g.last,
      });
    }
    // Un échantillon d'orgs sous forme de hash (jamais l'id en clair).
    for (const orgId of [...g.orgIds].slice(0, 50)) {
      evidenceRows.push({
        candidateId: candidate.id,
        organizationHash: organizationHash(orgId),
        detectedLanguage: g.language,
        weight: 0,
        seenAt: g.last,
      });
    }
    if (evidenceRows.length > 0) {
      await lcDb.learningEvidence.createMany({ data: evidenceRows });
    }
  }

  await lcAudit({
    action: "LEARNING_CANDIDATE_UPDATED",
    entityType: "learning_recompute",
    actorRef: actorRef ?? null,
    metadata: {
      created: res.candidatesCreated,
      updated: res.candidatesUpdated,
      conflicts: res.conflicts,
    },
  });

  return res;
}
