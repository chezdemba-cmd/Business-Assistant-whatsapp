import "server-only";
import type { RecommendationType, Role } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { recommendationScopeWhere } from "./recommendation-service";

/**
 * Assistant proactif (§17, §55). Résume les recommandations ouvertes en
 * « Djeli a détecté N points à surveiller aujourd'hui » + ventilation lisible.
 * Aucun chiffre inventé : tout vient des `BusinessRecommendation` déjà écrites
 * par les détecteurs (eux-mêmes adossés aux services métier).
 */

export type ProactiveItem = {
  type: RecommendationType;
  label: string;
  count: number;
  topPriority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  href: string;
};

export type ProactiveDigest = {
  total: number;
  headline: string;
  items: ProactiveItem[];
};

const LABELS: Record<RecommendationType, (n: number) => string> = {
  LOW_STOCK: (n) => `${n} produit(s) presque en rupture`,
  OUT_OF_STOCK: (n) => `${n} produit(s) en rupture`,
  OVERDUE_DEBT: (n) => `${n} créance(s) en retard`,
  PAYMENT_DUE_SOON: (n) => `${n} échéance(s) proche(s)`,
  INACTIVE_CUSTOMER: (n) => `${n} alerte(s) clients inactifs`,
  SALES_OPPORTUNITY: (n) => `${n} opportunité(s) commerciale(s)`,
  ORDER_PENDING_CONFIRMATION: (n) => `${n} commande(s) à confirmer`,
  ORDER_STUCK: (n) => `${n} commande(s) bloquée(s)`,
  ORDER_TO_PREPARE: (n) => `${n} lot(s) de commandes à préparer`,
  DAILY_SUMMARY: (n) => `${n} résumé(s) du jour`,
  ANOMALY: (n) => `${n} anomalie(s) détectée(s)`,
};

const HREF: Partial<Record<RecommendationType, string>> = {
  LOW_STOCK: "/stock",
  OUT_OF_STOCK: "/stock",
  OVERDUE_DEBT: "/debts",
  PAYMENT_DUE_SOON: "/debts",
  INACTIVE_CUSTOMER: "/marketing/new",
  SALES_OPPORTUNITY: "/customers",
  ORDER_PENDING_CONFIRMATION: "/orders",
  ORDER_STUCK: "/orders",
  ORDER_TO_PREPARE: "/orders",
};

const RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;

export async function getProactiveDigest(
  organizationId: string,
  role: Role,
  userId: string,
): Promise<ProactiveDigest> {
  const rows = await prisma.businessRecommendation.findMany({
    where: {
      organizationId,
      ...recommendationScopeWhere(role, userId),
      status: { in: ["NEW", "VIEWED", "ACTION_PREPARED"] },
      type: { not: "DAILY_SUMMARY" },
    },
    select: { type: true, priority: true },
  });

  const grouped = new Map<RecommendationType, { count: number; top: keyof typeof RANK }>();
  for (const r of rows) {
    const g = grouped.get(r.type) ?? { count: 0, top: "LOW" as keyof typeof RANK };
    g.count++;
    if (RANK[r.priority] > RANK[g.top]) g.top = r.priority;
    grouped.set(r.type, g);
  }

  const items: ProactiveItem[] = [...grouped.entries()]
    .map(([type, g]) => ({
      type,
      label: LABELS[type](g.count),
      count: g.count,
      topPriority: g.top,
      href: HREF[type] ?? "/recommendations",
    }))
    .sort((a, b) => RANK[b.topPriority] - RANK[a.topPriority] || b.count - a.count);

  const total = rows.length;
  const headline =
    total === 0
      ? "Rien de particulier à surveiller aujourd'hui."
      : `FEREDRON a détecté ${total} opportunité(s) ou action(s) à traiter aujourd'hui.`;

  return { total, headline, items };
}

/** Résumé du jour le plus récent (recommandation DAILY_SUMMARY). */
export async function getLatestDailySummary(organizationId: string) {
  return prisma.businessRecommendation.findFirst({
    where: { organizationId, type: "DAILY_SUMMARY" },
    orderBy: { detectedAt: "desc" },
  });
}
