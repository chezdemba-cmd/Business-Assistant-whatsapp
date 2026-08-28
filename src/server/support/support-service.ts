import "server-only";
import type { FeedbackCategory, SupportTicketType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logger } from "@/lib/logger";

/**
 * Support & feedback pilote (§23, §44). Le contenu privé des conversations
 * n'est jamais copié : uniquement ce que le commerçant décrit.
 */

export async function createSupportTicket(input: {
  organizationId: string;
  openedByUserId: string;
  type: SupportTicketType;
  subject: string;
  body: string;
  contactEmail?: string | null;
}): Promise<{ id: string }> {
  const t = await prisma.supportTicket.create({
    data: {
      organizationId: input.organizationId,
      openedByUserId: input.openedByUserId,
      type: input.type,
      subject: input.subject.trim().slice(0, 160),
      body: input.body.trim().slice(0, 4000),
      contactEmail: input.contactEmail?.trim() || null,
    },
    select: { id: true },
  });
  logger.info("support.ticket.created", {
    service: "support",
    event: "ticket_created",
    organizationId: input.organizationId,
    ticketType: input.type,
  });
  return t;
}

export function listSupportTickets(organizationId: string, take = 30) {
  return prisma.supportTicket.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function submitFeedback(input: {
  organizationId: string;
  authorUserId: string;
  category: FeedbackCategory;
  message: string;
  path?: string | null;
}): Promise<{ id: string }> {
  const f = await prisma.feedback.create({
    data: {
      organizationId: input.organizationId,
      authorUserId: input.authorUserId,
      category: input.category,
      message: input.message.trim().slice(0, 2000),
      path: input.path?.slice(0, 200) || null,
    },
    select: { id: true },
  });
  logger.info("feedback.submitted", {
    service: "support",
    event: "feedback_submitted",
    organizationId: input.organizationId,
    feedbackCategory: input.category,
  });
  return f;
}
