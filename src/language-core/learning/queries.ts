import "server-only";
import type {
  LanguageCode,
  LanguageScope,
  LearningCandidateStatus,
  LearningCandidateType,
  Prisma,
} from "@prisma/client";
import { lcDb } from "../db";

export type CandidateFilters = {
  language?: LanguageCode;
  domainCode?: string;
  scope?: LanguageScope;
  type?: LearningCandidateType;
  status?: LearningCandidateStatus;
  minScore?: number;
  limit?: number;
};

export function listCandidates(f: CandidateFilters = {}) {
  const where: Prisma.LearningCandidateWhereInput = {
    ...(f.language ? { language: f.language } : {}),
    ...(f.domainCode ? { domainCode: f.domainCode } : {}),
    ...(f.scope ? { scopeSuggestion: f.scope } : {}),
    ...(f.type ? { candidateType: f.type } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(typeof f.minScore === "number" ? { confidenceScore: { gte: f.minScore } } : {}),
  };
  return lcDb.learningCandidate.findMany({
    where,
    orderBy: [{ confidenceScore: "desc" }, { lastSeenAt: "desc" }],
    take: Math.min(200, Math.max(1, f.limit ?? 50)),
  });
}

export async function getCandidate(id: string) {
  return lcDb.learningCandidate.findUnique({
    where: { id },
    include: {
      evidence: { orderBy: { createdAt: "asc" }, take: 200 },
      reviews: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}

/** Compte des organisations distinctes (hash) reliées — vue reviewer, sans PII. */
export async function candidateOrganizationHashes(candidateId: string): Promise<string[]> {
  const rows = await lcDb.learningEvidence.findMany({
    where: { candidateId, organizationHash: { not: null } },
    select: { organizationHash: true },
    distinct: ["organizationHash"],
  });
  return rows.map((r) => r.organizationHash!).filter(Boolean);
}
