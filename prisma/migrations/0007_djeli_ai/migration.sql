-- CreateEnum
CREATE TYPE "AiAutomationType" AS ENUM ('WHATSAPP_AUTO_REPLY', 'INTERNAL_ASSISTANT');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'HANDOFF', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AiConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AiToolCallStatus" AS ENUM ('OK', 'ERROR', 'DENIED');

-- CreateEnum
CREATE TYPE "OrderDraftStatus" AS ENUM ('DRAFT', 'AWAITING_CUSTOMER_CONFIRMATION', 'CUSTOMER_CONFIRMED', 'AWAITING_HUMAN_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "AiActionType" AS ENUM ('CREATE_ORDER_FROM_DRAFT', 'PREPARE_REMINDER');

-- CreateEnum
CREATE TYPE "AiActionProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CustomerActivityType" ADD VALUE 'AI_ORDER_DRAFT_CREATED';
ALTER TYPE "CustomerActivityType" ADD VALUE 'AI_HANDOFF';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "aiRunId" TEXT,
ADD COLUMN     "generatedByAi" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "userId" TEXT,
    "automationType" "AiAutomationType" NOT NULL,
    "intent" TEXT,
    "language" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" "AiRunStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" "AiConfidence",
    "handoffReason" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tool_calls" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aiRunId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "status" "AiToolCallStatus" NOT NULL,
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_drafts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT,
    "customerId" TEXT,
    "createdByUserId" TEXT,
    "sourceMessageId" TEXT,
    "status" "OrderDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "deliveryAddress" TEXT,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "convertedOrderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_draft_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderDraftId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_draft_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_action_proposals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aiRunId" TEXT,
    "conversationId" TEXT,
    "type" "AiActionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "AiActionProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "resultSummary" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_action_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_runs_organizationId_createdAt_idx" ON "ai_runs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_runs_conversationId_idx" ON "ai_runs"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_runs_messageId_automationType_key" ON "ai_runs"("messageId", "automationType");

-- CreateIndex
CREATE INDEX "ai_tool_calls_aiRunId_idx" ON "ai_tool_calls"("aiRunId");

-- CreateIndex
CREATE INDEX "ai_tool_calls_organizationId_createdAt_idx" ON "ai_tool_calls"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "order_drafts_organizationId_status_idx" ON "order_drafts"("organizationId", "status");

-- CreateIndex
CREATE INDEX "order_drafts_conversationId_idx" ON "order_drafts"("conversationId");

-- CreateIndex
CREATE INDEX "order_drafts_customerId_idx" ON "order_drafts"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "order_drafts_conversationId_sourceMessageId_key" ON "order_drafts"("conversationId", "sourceMessageId");

-- CreateIndex
CREATE INDEX "order_draft_items_orderDraftId_idx" ON "order_draft_items"("orderDraftId");

-- CreateIndex
CREATE INDEX "ai_action_proposals_organizationId_status_idx" ON "ai_action_proposals"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ai_action_proposals_conversationId_idx" ON "ai_action_proposals"("conversationId");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_drafts" ADD CONSTRAINT "order_drafts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_drafts" ADD CONSTRAINT "order_drafts_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_drafts" ADD CONSTRAINT "order_drafts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_drafts" ADD CONSTRAINT "order_drafts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_drafts" ADD CONSTRAINT "order_drafts_convertedOrderId_fkey" FOREIGN KEY ("convertedOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_draft_items" ADD CONSTRAINT "order_draft_items_orderDraftId_fkey" FOREIGN KEY ("orderDraftId") REFERENCES "order_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_proposals" ADD CONSTRAINT "ai_action_proposals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_proposals" ADD CONSTRAINT "ai_action_proposals_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_proposals" ADD CONSTRAINT "ai_action_proposals_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_proposals" ADD CONSTRAINT "ai_action_proposals_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

