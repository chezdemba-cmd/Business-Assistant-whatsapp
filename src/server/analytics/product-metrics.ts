import "server-only";
import { prisma } from "@/server/db/client";

/**
 * Product analytics plateforme (§45, §46). Agrégats uniquement — aucun contenu
 * privé. Sert la console opérateur et le suivi du pilote.
 */

function daysAgo(n: number, now: Date): Date {
  return new Date(now.getTime() - n * 86_400_000);
}

export type ActivationBreakdown = {
  total: number;
  hasProducts: number;
  hasCustomers: number;
  hasOrders: number;
  hasWhatsApp: number;
  usedAi: number;
  /** Organisations « activées » : toutes les étapes ci-dessus franchies (§46). */
  activated: number;
};

export async function getActivationBreakdown(): Promise<ActivationBreakdown> {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      _count: {
        select: {
          products: true,
          customers: true,
          orders: true,
          aiRuns: true,
        },
      },
      whatsappConnections: { where: { status: "CONNECTED" }, select: { id: true }, take: 1 },
    },
  });

  const b: ActivationBreakdown = {
    total: orgs.length,
    hasProducts: 0,
    hasCustomers: 0,
    hasOrders: 0,
    hasWhatsApp: 0,
    usedAi: 0,
    activated: 0,
  };
  for (const o of orgs) {
    const p = o._count.products > 0;
    const c = o._count.customers > 0;
    const ord = o._count.orders > 0;
    const wa = o.whatsappConnections.length > 0;
    const ai = o._count.aiRuns > 0;
    if (p) b.hasProducts++;
    if (c) b.hasCustomers++;
    if (ord) b.hasOrders++;
    if (wa) b.hasWhatsApp++;
    if (ai) b.usedAi++;
    if (p && c && ord && wa && ai) b.activated++;
  }
  return b;
}

export type PlatformUsage = {
  activeOrganizations7d: number;
  activeUsers24h: number;
  ordersCreated7d: number;
  ordersCreated30d: number;
  conversations7d: number;
  aiRuns7d: number;
  voiceTranscriptions7d: number;
  recommendationsActed30d: number;
  marketingSends30d: number;
};

export async function getPlatformUsage(now: Date = new Date()): Promise<PlatformUsage> {
  const d7 = daysAgo(7, now);
  const d30 = daysAgo(30, now);
  const d1 = daysAgo(1, now);

  const [
    activeOrgs,
    activeUsers,
    orders7,
    orders30,
    conv7,
    ai7,
    voice7,
    recoActed,
    mkt30,
  ] = await Promise.all([
    prisma.aiRun
      .findMany({ where: { createdAt: { gte: d7 } }, select: { organizationId: true }, distinct: ["organizationId"] })
      .then((r) => r.length),
    prisma.user.count({ where: { lastLoginAt: { gte: d1 } } }),
    prisma.order.count({ where: { createdAt: { gte: d7 } } }),
    prisma.order.count({ where: { createdAt: { gte: d30 } } }),
    prisma.conversation.count({ where: { createdAt: { gte: d7 } } }),
    prisma.aiRun.count({ where: { createdAt: { gte: d7 } } }),
    prisma.voiceTranscription.count({ where: { createdAt: { gte: d7 } } }),
    prisma.businessRecommendation.count({
      where: { updatedAt: { gte: d30 }, status: { in: ["ACTIONED", "ACTION_PREPARED"] } },
    }),
    prisma.marketingCampaignItem.count({ where: { sentAt: { gte: d30 }, status: "SENT" } }),
  ]);

  return {
    activeOrganizations7d: activeOrgs,
    activeUsers24h: activeUsers,
    ordersCreated7d: orders7,
    ordersCreated30d: orders30,
    conversations7d: conv7,
    aiRuns7d: ai7,
    voiceTranscriptions7d: voice7,
    recommendationsActed30d: recoActed,
    marketingSends30d: mkt30,
  };
}
