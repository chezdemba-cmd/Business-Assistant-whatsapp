import "server-only";
import type { Prisma } from "@prisma/client";
import { lcDb } from "./db";
import { logError } from "@/server/errors";

export type LanguageAuditAction =
  | "LANGUAGE_ENTRY_CREATED"
  | "LANGUAGE_ENTRY_UPDATED"
  | "LANGUAGE_ENTRY_VALIDATED"
  | "LANGUAGE_ENTRY_REJECTED"
  | "LANGUAGE_ENTRY_ARCHIVED"
  | "VARIANT_ADDED"
  | "TRANSLATION_ADDED"
  | "INTENT_MAPPING_ADDED"
  | "EXAMPLE_ADDED"
  | "OBSERVATION_SUBMITTED"
  | "CORRECTION_SUBMITTED"
  | "IMPORT_CREATED"
  | "EXPORT_CREATED"
  // Phase 6D — Learning Loop
  | "LEARNING_CANDIDATE_CREATED"
  | "LEARNING_CANDIDATE_UPDATED"
  | "LEARNING_CANDIDATE_APPROVED"
  | "LEARNING_CANDIDATE_REJECTED"
  | "LEARNING_CANDIDATE_PROMOTED"
  | "LEARNING_DATASET_EXPORTED";

/** Journal propre au Language Core — jamais de PII ni de secret. */
export async function lcAudit(input: {
  action: LanguageAuditAction;
  entityType: string;
  entityId?: string | null;
  applicationCode?: string | null;
  actorRef?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await lcDb.languageAuditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        applicationCode: input.applicationCode ?? null,
        actorRef: input.actorRef ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    logError("language-core.audit", error);
  }
}
