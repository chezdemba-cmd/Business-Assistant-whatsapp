-- CreateEnum
CREATE TYPE "LearningCandidateType" AS ENUM ('NEW_ENTRY', 'VARIANT', 'TRANSLATION', 'INTENT_MAPPING', 'NORMALIZATION_PATTERN', 'PRONUNCIATION_VARIANT', 'OTHER');

-- CreateEnum
CREATE TYPE "LearningCandidateStatus" AS ENUM ('NEW', 'REVIEW_PENDING', 'APPROVED', 'REJECTED', 'PROMOTED', 'IGNORED', 'ARCHIVED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "LearningReviewAction" AS ENUM ('APPROVE', 'REJECT', 'IGNORE', 'EDIT', 'PROMOTE', 'MARK_USEFUL', 'MARK_WRONG', 'RECOMPUTE_TOUCH');

-- CreateTable
CREATE TABLE "learning_candidates" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "domainCode" TEXT,
    "scopeSuggestion" "LanguageScope" NOT NULL DEFAULT 'ORGANIZATION',
    "organizationId" TEXT,
    "candidateType" "LearningCandidateType" NOT NULL,
    "canonicalText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "originalPattern" TEXT,
    "proposedMeaning" TEXT,
    "proposedTranslation" TEXT,
    "proposedTranslationLang" "LanguageCode",
    "proposedIntentCode" TEXT,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "organizationCount" INTEGER NOT NULL DEFAULT 0,
    "correctionCount" INTEGER NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION,
    "shareable" BOOLEAN NOT NULL DEFAULT false,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "status" "LearningCandidateStatus" NOT NULL DEFAULT 'NEW',
    "evidenceSummary" JSONB NOT NULL,
    "conflictEntryId" TEXT,
    "promotedEntryId" TEXT,
    "datasetSplit" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "reviewedByRef" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_evidence" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "observationId" TEXT,
    "correctionId" TEXT,
    "applicationCode" TEXT,
    "domainCode" TEXT,
    "organizationHash" TEXT,
    "detectedLanguage" "LanguageCode" NOT NULL DEFAULT 'OTHER',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_reviews" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "action" "LearningReviewAction" NOT NULL,
    "actorRef" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_candidates_dedupeKey_key" ON "learning_candidates"("dedupeKey");

-- CreateIndex
CREATE INDEX "learning_candidates_status_language_idx" ON "learning_candidates"("status", "language");

-- CreateIndex
CREATE INDEX "learning_candidates_scopeSuggestion_status_idx" ON "learning_candidates"("scopeSuggestion", "status");

-- CreateIndex
CREATE INDEX "learning_candidates_domainCode_status_idx" ON "learning_candidates"("domainCode", "status");

-- CreateIndex
CREATE INDEX "learning_candidates_organizationId_status_idx" ON "learning_candidates"("organizationId", "status");

-- CreateIndex
CREATE INDEX "learning_evidence_candidateId_idx" ON "learning_evidence"("candidateId");

-- CreateIndex
CREATE INDEX "learning_evidence_observationId_idx" ON "learning_evidence"("observationId");

-- CreateIndex
CREATE INDEX "learning_evidence_correctionId_idx" ON "learning_evidence"("correctionId");

-- CreateIndex
CREATE INDEX "learning_reviews_candidateId_createdAt_idx" ON "learning_reviews"("candidateId", "createdAt");

-- AddForeignKey
ALTER TABLE "learning_evidence" ADD CONSTRAINT "learning_evidence_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "learning_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_reviews" ADD CONSTRAINT "learning_reviews_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "learning_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

