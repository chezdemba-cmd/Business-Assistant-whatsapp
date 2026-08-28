-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('BM', 'FR', 'MIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "LanguageScope" AS ENUM ('GLOBAL', 'DOMAIN', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "LanguageEntryStatus" AS ENUM ('OBSERVED', 'SUGGESTED', 'VALIDATED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LanguageSource" AS ENUM ('HUMAN', 'BUSINESS_CORRECTION', 'VOICE_CORRECTION', 'IMPORT', 'RESEARCH', 'SYSTEM', 'OTHER');

-- CreateEnum
CREATE TYPE "LanguageVariantType" AS ENUM ('SPELLING', 'PRONUNCIATION', 'COLLOQUIAL', 'CODE_SWITCH', 'ABBREVIATION', 'SYNONYM', 'OTHER');

-- CreateEnum
CREATE TYPE "LanguageConsentStatus" AS ENUM ('UNKNOWN', 'NOT_REQUIRED', 'GRANTED', 'REVOKED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "LanguageDomainStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LanguageApplicationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LanguageObservationStatus" AS ENUM ('NEW', 'LINKED', 'DISMISSED');

-- CreateTable
CREATE TABLE "language_domains" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "LanguageDomainStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_entries" (
    "id" TEXT NOT NULL,
    "canonicalText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "meaning" TEXT,
    "frenchTranslation" TEXT,
    "englishTranslation" TEXT,
    "scope" "LanguageScope" NOT NULL DEFAULT 'ORGANIZATION',
    "domainCode" TEXT,
    "organizationId" TEXT,
    "status" "LanguageEntryStatus" NOT NULL DEFAULT 'OBSERVED',
    "confidence" DOUBLE PRECISION,
    "source" "LanguageSource" NOT NULL DEFAULT 'HUMAN',
    "provenance" JSONB,
    "createdByRef" TEXT,
    "validatedByRef" TEXT,
    "validatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_variants" (
    "id" TEXT NOT NULL,
    "languageEntryId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "variantType" "LanguageVariantType" NOT NULL DEFAULT 'SPELLING',
    "region" TEXT,
    "notes" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" "LanguageEntryStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_translations" (
    "id" TEXT NOT NULL,
    "languageEntryId" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "text" TEXT NOT NULL,
    "status" "LanguageEntryStatus" NOT NULL DEFAULT 'SUGGESTED',
    "source" "LanguageSource" NOT NULL DEFAULT 'HUMAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_intent_mappings" (
    "id" TEXT NOT NULL,
    "languageEntryId" TEXT NOT NULL,
    "intentCode" TEXT NOT NULL,
    "domainCode" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" "LanguageEntryStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_intent_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_examples" (
    "id" TEXT NOT NULL,
    "languageEntryId" TEXT NOT NULL,
    "exampleText" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "domainCode" TEXT,
    "intentCode" TEXT,
    "source" "LanguageSource" NOT NULL DEFAULT 'HUMAN',
    "status" "LanguageEntryStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_pronunciation_examples" (
    "id" TEXT NOT NULL,
    "languageEntryId" TEXT NOT NULL,
    "audioStorageKey" TEXT,
    "transcript" TEXT NOT NULL,
    "region" TEXT,
    "speakerMetadata" JSONB,
    "consentStatus" "LanguageConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "qualityScore" DOUBLE PRECISION,
    "source" "LanguageSource" NOT NULL DEFAULT 'HUMAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_pronunciation_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_entry_revisions" (
    "id" TEXT NOT NULL,
    "languageEntryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedByRef" TEXT,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_entry_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_observations" (
    "id" TEXT NOT NULL,
    "applicationCode" TEXT NOT NULL,
    "organizationId" TEXT,
    "domainCode" TEXT,
    "originalText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "detectedLanguage" "LanguageCode" NOT NULL DEFAULT 'OTHER',
    "contextType" TEXT,
    "sourceReference" TEXT,
    "status" "LanguageObservationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_corrections" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "correctedText" TEXT NOT NULL,
    "correctedByRef" TEXT,
    "detectedLanguage" "LanguageCode" NOT NULL DEFAULT 'OTHER',
    "context" TEXT,
    "consentStatus" "LanguageConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "sanitizedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_applications" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "LanguageApplicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_application_clients" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "status" "LanguageApplicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_application_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_dataset_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "url" TEXT,
    "attribution" TEXT,
    "usageRestrictions" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_dataset_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "applicationCode" TEXT,
    "actorRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_resolve_metrics" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "applicationCode" TEXT NOT NULL DEFAULT '-',
    "domainCode" TEXT NOT NULL DEFAULT '-',
    "language" "LanguageCode" NOT NULL DEFAULT 'OTHER',
    "resolveCount" INTEGER NOT NULL DEFAULT 0,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "noMatchCount" INTEGER NOT NULL DEFAULT 0,
    "totalLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_resolve_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "language_domains_code_key" ON "language_domains"("code");

-- CreateIndex
CREATE INDEX "language_entries_language_status_idx" ON "language_entries"("language", "status");

-- CreateIndex
CREATE INDEX "language_entries_scope_status_idx" ON "language_entries"("scope", "status");

-- CreateIndex
CREATE INDEX "language_entries_domainCode_status_idx" ON "language_entries"("domainCode", "status");

-- CreateIndex
CREATE INDEX "language_entries_organizationId_status_idx" ON "language_entries"("organizationId", "status");

-- CreateIndex
CREATE INDEX "language_entries_normalizedText_idx" ON "language_entries"("normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "language_entries_normalizedText_language_scope_domainCode_o_key" ON "language_entries"("normalizedText", "language", "scope", "domainCode", "organizationId");

-- CreateIndex
CREATE INDEX "language_variants_languageEntryId_idx" ON "language_variants"("languageEntryId");

-- CreateIndex
CREATE INDEX "language_variants_normalizedText_idx" ON "language_variants"("normalizedText");

-- CreateIndex
CREATE INDEX "language_translations_languageEntryId_idx" ON "language_translations"("languageEntryId");

-- CreateIndex
CREATE INDEX "language_intent_mappings_languageEntryId_idx" ON "language_intent_mappings"("languageEntryId");

-- CreateIndex
CREATE INDEX "language_intent_mappings_intentCode_status_idx" ON "language_intent_mappings"("intentCode", "status");

-- CreateIndex
CREATE INDEX "language_examples_languageEntryId_idx" ON "language_examples"("languageEntryId");

-- CreateIndex
CREATE INDEX "language_pronunciation_examples_languageEntryId_idx" ON "language_pronunciation_examples"("languageEntryId");

-- CreateIndex
CREATE INDEX "language_entry_revisions_languageEntryId_idx" ON "language_entry_revisions"("languageEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "language_entry_revisions_languageEntryId_version_key" ON "language_entry_revisions"("languageEntryId", "version");

-- CreateIndex
CREATE INDEX "language_observations_applicationCode_createdAt_idx" ON "language_observations"("applicationCode", "createdAt");

-- CreateIndex
CREATE INDEX "language_observations_domainCode_status_idx" ON "language_observations"("domainCode", "status");

-- CreateIndex
CREATE INDEX "language_corrections_observationId_idx" ON "language_corrections"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "language_applications_code_key" ON "language_applications"("code");

-- CreateIndex
CREATE UNIQUE INDEX "language_application_clients_clientId_key" ON "language_application_clients"("clientId");

-- CreateIndex
CREATE INDEX "language_application_clients_applicationId_idx" ON "language_application_clients"("applicationId");

-- CreateIndex
CREATE INDEX "language_audit_logs_createdAt_idx" ON "language_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "language_audit_logs_action_idx" ON "language_audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "language_resolve_metrics_day_applicationCode_domainCode_lan_key" ON "language_resolve_metrics"("day", "applicationCode", "domainCode", "language");

-- AddForeignKey
ALTER TABLE "language_variants" ADD CONSTRAINT "language_variants_languageEntryId_fkey" FOREIGN KEY ("languageEntryId") REFERENCES "language_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_translations" ADD CONSTRAINT "language_translations_languageEntryId_fkey" FOREIGN KEY ("languageEntryId") REFERENCES "language_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_intent_mappings" ADD CONSTRAINT "language_intent_mappings_languageEntryId_fkey" FOREIGN KEY ("languageEntryId") REFERENCES "language_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_examples" ADD CONSTRAINT "language_examples_languageEntryId_fkey" FOREIGN KEY ("languageEntryId") REFERENCES "language_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_pronunciation_examples" ADD CONSTRAINT "language_pronunciation_examples_languageEntryId_fkey" FOREIGN KEY ("languageEntryId") REFERENCES "language_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_entry_revisions" ADD CONSTRAINT "language_entry_revisions_languageEntryId_fkey" FOREIGN KEY ("languageEntryId") REFERENCES "language_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_corrections" ADD CONSTRAINT "language_corrections_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "language_observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_application_clients" ADD CONSTRAINT "language_application_clients_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "language_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

