-- CreateEnum
CREATE TYPE "AutomationRuleType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'OVERDUE_DEBT', 'INACTIVE_CUSTOMER', 'ORDER_PENDING_CONFIRMATION', 'ORDER_STUCK', 'ORDER_TO_PREPARE', 'DAILY_SUMMARY', 'PAYMENT_DUE_SOON', 'SALES_OPPORTUNITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'OVERDUE_DEBT', 'PAYMENT_DUE_SOON', 'INACTIVE_CUSTOMER', 'SALES_OPPORTUNITY', 'ORDER_PENDING_CONFIRMATION', 'ORDER_STUCK', 'ORDER_TO_PREPARE', 'DAILY_SUMMARY', 'ANOMALY');

-- CreateEnum
CREATE TYPE "RecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('NEW', 'VIEWED', 'DISMISSED', 'ACTION_PREPARED', 'ACTIONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RecommendationActionType" AS ENUM ('PREPARE_REMINDER', 'PREPARE_CAMPAIGN', 'OPEN_CUSTOMER', 'OPEN_ORDER', 'OPEN_PRODUCT');

-- CreateEnum
CREATE TYPE "MarketingCampaignType" AS ENUM ('CUSTOMER_REACTIVATION', 'PROMOTION', 'NEW_PRODUCT', 'LOW_ACTIVITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('DRAFT', 'READY', 'SCHEDULED', 'SENDING', 'SENT', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketingChannel" AS ENUM ('WHATSAPP', 'OTHER');

-- CreateEnum
CREATE TYPE "MarketingAudienceType" AS ENUM ('INACTIVE_CUSTOMERS', 'CUSTOMER_TYPE', 'AREA', 'PRODUCT_BUYERS', 'ALL_OPTED_IN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MarketingItemStatus" AS ENUM ('PENDING', 'SKIPPED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RECOMMENDATION', 'ORDER', 'DEBT', 'STOCK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('AI_PROCESS', 'VOICE_TRANSCRIBE', 'AUTOMATION_RUN', 'WHATSAPP_SEND', 'DAILY_SUMMARY');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "marketingOptInAt" TIMESTAMP(3),
ADD COLUMN     "marketingOptOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AutomationRuleType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "schedule" TEXT,
    "severity" "RecommendationPriority",
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleId" TEXT,
    "type" "AutomationRuleType" NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "itemsDetected" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "metadata" JSONB,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_recommendations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "RecommendationPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "RecommendationStatus" NOT NULL DEFAULT 'NEW',
    "entityType" TEXT,
    "entityId" TEXT,
    "actionType" "RecommendationActionType",
    "actionPayload" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "cooldownUntil" TIMESTAMP(3),
    "facts" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "dismissedByUserId" TEXT,
    "actedAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MarketingCampaignType" NOT NULL,
    "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceType" "MarketingAudienceType" NOT NULL,
    "audienceConfig" JSONB NOT NULL DEFAULT '{}',
    "message" TEXT NOT NULL,
    "channel" "MarketingChannel" NOT NULL DEFAULT 'WHATSAPP',
    "templateName" TEXT,
    "templateLang" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaign_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "messageSnapshot" TEXT NOT NULL,
    "status" "MarketingItemStatus" NOT NULL DEFAULT 'PENDING',
    "externalMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_campaign_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rules_organizationId_enabled_idx" ON "automation_rules"("organizationId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "automation_rules_organizationId_type_key" ON "automation_rules"("organizationId", "type");

-- CreateIndex
CREATE INDEX "automation_runs_organizationId_startedAt_idx" ON "automation_runs"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "automation_runs_organizationId_type_idx" ON "automation_runs"("organizationId", "type");

-- CreateIndex
CREATE INDEX "business_recommendations_organizationId_status_priority_idx" ON "business_recommendations"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "business_recommendations_organizationId_type_status_idx" ON "business_recommendations"("organizationId", "type", "status");

-- CreateIndex
CREATE INDEX "business_recommendations_organizationId_ownerUserId_status_idx" ON "business_recommendations"("organizationId", "ownerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_recommendations_organizationId_dedupeKey_key" ON "business_recommendations"("organizationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "marketing_campaigns_organizationId_status_idx" ON "marketing_campaigns"("organizationId", "status");

-- CreateIndex
CREATE INDEX "marketing_campaigns_organizationId_createdAt_idx" ON "marketing_campaigns"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "marketing_campaign_items_organizationId_idx" ON "marketing_campaign_items"("organizationId");

-- CreateIndex
CREATE INDEX "marketing_campaign_items_campaignId_status_idx" ON "marketing_campaign_items"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_campaign_items_campaignId_customerId_key" ON "marketing_campaign_items"("campaignId", "customerId");

-- CreateIndex
CREATE INDEX "notifications_organizationId_userId_readAt_idx" ON "notifications"("organizationId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_organizationId_createdAt_idx" ON "notifications"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_dedupeKey_key" ON "jobs"("dedupeKey");

-- CreateIndex
CREATE INDEX "jobs_status_runAfter_idx" ON "jobs"("status", "runAfter");

-- CreateIndex
CREATE INDEX "jobs_organizationId_type_status_idx" ON "jobs"("organizationId", "type", "status");

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_recommendations" ADD CONSTRAINT "business_recommendations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_recommendations" ADD CONSTRAINT "business_recommendations_dismissedByUserId_fkey" FOREIGN KEY ("dismissedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaign_items" ADD CONSTRAINT "marketing_campaign_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaign_items" ADD CONSTRAINT "marketing_campaign_items_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaign_items" ADD CONSTRAINT "marketing_campaign_items_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

