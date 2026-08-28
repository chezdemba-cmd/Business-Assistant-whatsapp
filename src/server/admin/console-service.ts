import "server-only";
import type { PlanCode, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { NotFound } from "@/server/errors";
import { getUsageSnapshot } from "@/server/billing/usage-service";
import { getSubscriptionSummary } from "@/server/billing/subscription-service";

/**
 * Données de la console opérateur (§22). AUCUN contenu privé (messages,
 * conversations, notes clients) — uniquement de l'agrégat et du statut.
 */

export type AdminOrgRow = {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  currency: string;
  isPilot: boolean;
  isDemo: boolean;
  status: string;
  createdAt: Date;
  planCode: PlanCode | null;
  subStatus: SubscriptionStatus | null;
  trialEndsAt: Date | null;
  members: number;
  whatsappConnected: boolean;
};

export async function listOrganizations(limit = 100): Promise<AdminOrgRow[]> {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      slug: true,
      countryCode: true,
      currency: true,
      isPilot: true,
      isDemo: true,
      status: true,
      createdAt: true,
      subscription: { select: { status: true, plan: { select: { code: true } }, trialEndsAt: true } },
      _count: { select: { members: true } },
      whatsappConnections: { where: { status: "CONNECTED" }, select: { id: true }, take: 1 },
    },
  });

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    countryCode: o.countryCode,
    currency: o.currency,
    isPilot: o.isPilot,
    isDemo: o.isDemo,
    status: o.status,
    createdAt: o.createdAt,
    planCode: o.subscription?.plan.code ?? null,
    subStatus: o.subscription?.status ?? null,
    trialEndsAt: o.subscription?.trialEndsAt ?? null,
    members: o._count.members,
    whatsappConnected: o.whatsappConnections.length > 0,
  }));
}

export async function getOrganizationAdminView(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      countryCode: true,
      currency: true,
      timezone: true,
      status: true,
      isPilot: true,
      isDemo: true,
      createdAt: true,
      onboardedAt: true,
    },
  });
  if (!org) throw NotFound("Organisation introuvable.");

  const [subscription, usage, counts, whatsapp, members, recentErrors] = await Promise.all([
    getSubscriptionSummary(organizationId),
    getUsageSnapshot(organizationId, org.timezone),
    Promise.all([
      prisma.product.count({ where: { organizationId } }),
      prisma.customer.count({ where: { organizationId } }),
      prisma.order.count({ where: { organizationId } }),
      prisma.conversation.count({ where: { organizationId } }),
      prisma.aiRun.count({ where: { organizationId } }),
    ]),
    prisma.whatsAppConnection.findMany({
      where: { organizationId },
      select: { status: true, displayPhoneNumber: true, verifiedName: true, lastEventAt: true, lastError: true },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId },
      select: { role: true, status: true, user: { select: { email: true, firstName: true, lastName: true } } },
    }),
    prisma.auditLog.findMany({
      where: { organizationId, action: { in: ["WHATSAPP_DISCONNECTED", "VOICE_TRANSCRIPTION_FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { action: true, createdAt: true },
    }),
  ]);

  return {
    org,
    subscription,
    usage,
    counts: {
      products: counts[0],
      customers: counts[1],
      orders: counts[2],
      conversations: counts[3],
      aiRuns: counts[4],
    },
    whatsapp,
    members,
    recentErrors,
  };
}

export async function togglePilot(organizationId: string, isPilot: boolean): Promise<void> {
  await prisma.organization.update({ where: { id: organizationId }, data: { isPilot } });
}

export async function platformMetrics() {
  const [orgs, pilots, activeSubs, trials] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { isPilot: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIAL" } }),
  ]);
  return { organizations: orgs, pilots, activeSubscriptions: activeSubs, trials };
}
