-- Rattrape un drift : schema.prisma déclarait ces éléments sur LanguageObservation
-- (idempotence des observations, type de match résolu, rétention) sans migration
-- correspondante. observation-service.ts / learning/aggregator.ts les utilisent.

-- AlterTable
ALTER TABLE "language_observations" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "resolvedMatchType" TEXT,
ADD COLUMN     "retentionUntil" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "language_observations_idempotencyKey_key" ON "language_observations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "language_observations_normalizedText_idx" ON "language_observations"("normalizedText");
