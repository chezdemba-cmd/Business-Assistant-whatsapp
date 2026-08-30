import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logError } from "@/server/errors";

export type AuditAction =
  | "USER_REGISTERED"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "PROFILE_UPDATED"
  | "ORGANIZATION_CREATED"
  | "ORGANIZATION_UPDATED"
  | "ORGANIZATION_PURGED"
  | "SETTINGS_UPDATED"
  | "MEMBER_INVITED"
  | "MEMBER_INVITE_REVOKED"
  | "MEMBER_JOINED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_REMOVED"
  | "MEMBER_SUSPENDED"
  | "MEMBER_REACTIVATED"
  // Phase 2 — catalogue & stock
  | "CATEGORY_CREATED"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_ARCHIVED"
  | "PRODUCT_RESTORED"
  | "STOCK_INITIALIZED"
  | "STOCK_MOVEMENT_RECORDED"
  | "STOCK_INVENTORY_ADJUSTED"
  | "STOCK_MOVEMENT_REVERSED"
  // Phase 3 — CRM & commandes
  | "CUSTOMER_CREATED"
  | "CUSTOMER_UPDATED"
  | "CUSTOMER_ARCHIVED"
  | "CUSTOMER_RESTORED"
  | "ORDER_CREATED"
  | "ORDER_UPDATED"
  | "ORDER_STATUS_CHANGED"
  | "ORDER_CANCELLED"
  | "ORDER_DELIVERED"
  | "STOCK_RESERVED"
  | "STOCK_RESERVATION_RELEASED"
  | "STOCK_RESERVATION_FULFILLED"
  // Phase 4 — créances, paiements, relances
  | "PAYMENT_RECORDED"
  | "PAYMENT_CANCELLED"
  | "DUE_DATE_UPDATED"
  | "REMINDER_CAMPAIGN_CREATED"
  | "REMINDER_SENT"
  | "REMINDER_CANCELLED"
  // Phase 5 — WhatsApp & conversations
  | "WHATSAPP_CONNECTED"
  | "WHATSAPP_DISCONNECTED"
  | "CONVERSATION_ASSIGNED"
  | "CONVERSATION_MODE_CHANGED"
  | "MESSAGE_SENT"
  // Phase 6 — Djeli IA
  | "AI_RUN_COMPLETED"
  | "AI_HANDOFF"
  | "AI_ACTION_PROPOSED"
  | "AI_ACTION_APPROVED"
  | "AI_ACTION_REJECTED"
  | "AI_ORDER_DRAFT_CREATED"
  | "AI_ORDER_DRAFT_CONVERTED"
  // Phase 6B — Djeli Voice
  | "VOICE_TRANSCRIPTION_COMPLETED"
  | "VOICE_TRANSCRIPTION_FAILED"
  | "VOICE_TRANSCRIPTION_CORRECTED"
  // Phase 7 — automatisations, recommandations, marketing
  | "AUTOMATION_RULE_CREATED"
  | "AUTOMATION_RULE_UPDATED"
  | "AUTOMATION_RUN_COMPLETED"
  | "RECOMMENDATION_CREATED"
  | "RECOMMENDATION_DISMISSED"
  | "MARKETING_CAMPAIGN_CREATED"
  | "MARKETING_CAMPAIGN_APPROVED"
  | "MARKETING_CAMPAIGN_SENT"
  | "MARKETING_OPT_OUT";

export type AuditInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  organizationId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

/**
 * Journalise un événement. L'échec d'écriture d'audit ne doit JAMAIS
 * faire échouer l'action métier — on log l'erreur et on continue.
 */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        organizationId: input.organizationId ?? null,
        actorUserId: input.actorUserId ?? null,
        ipAddress: input.ipAddress ?? null,
        metadata:
          input.metadata === undefined
            ? Prisma.JsonNull
            : (input.metadata as Prisma.InputJsonValue),
      },
    });
  } catch (error) {
    logError("writeAuditLog", error);
  }
}

export function listAuditLogs(organizationId: string, take = 50) {
  return prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { firstName: true, lastName: true } } },
  });
}
