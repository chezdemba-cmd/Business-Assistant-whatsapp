-- CreateEnum
CREATE TYPE "VoiceLanguage" AS ENUM ('FR', 'BM', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VoiceTranscriptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CORRECTED');

-- CreateTable
CREATE TABLE "voice_transcriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "originalText" TEXT NOT NULL DEFAULT '',
    "correctedText" TEXT,
    "effectiveText" TEXT NOT NULL DEFAULT '',
    "normalizedText" TEXT,
    "detectedLanguage" "VoiceLanguage" NOT NULL DEFAULT 'UNKNOWN',
    "providerLanguage" TEXT,
    "confidence" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "audioSeconds" INTEGER,
    "providerCost" DOUBLE PRECISION,
    "status" "VoiceTranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "correctedByUserId" TEXT,
    "correctedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_transcriptions_messageId_key" ON "voice_transcriptions"("messageId");

-- CreateIndex
CREATE INDEX "voice_transcriptions_organizationId_createdAt_idx" ON "voice_transcriptions"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "voice_transcriptions_organizationId_status_idx" ON "voice_transcriptions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "voice_transcriptions_conversationId_idx" ON "voice_transcriptions"("conversationId");

-- AddForeignKey
ALTER TABLE "voice_transcriptions" ADD CONSTRAINT "voice_transcriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcriptions" ADD CONSTRAINT "voice_transcriptions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcriptions" ADD CONSTRAINT "voice_transcriptions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcriptions" ADD CONSTRAINT "voice_transcriptions_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

