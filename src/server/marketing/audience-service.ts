import "server-only";
import type { MarketingAudienceType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { buildAudiencePlan, type AudienceConfig } from "./audience-rules";
import { splitAudienceByConsent } from "./consent";

/**
 * Résolution d'audience (§23, §27). Retourne la liste des clients CIBLÉS puis
 * la sépare en inclus / exclus (opt-out) / exclus (injoignables). Le filtre de
 * consentement est TOUJOURS appliqué ici — impossible à contourner par l'appelant.
 */

export const AUDIENCE_HARD_CAP = 5000;

export type AudienceCustomer = {
  id: string;
  displayName: string;
  phone: string | null;
  marketingOptIn: boolean;
  marketingOptOutAt: Date | null;
  status: string;
  area: string | null;
  city: string | null;
};

export type ResolvedAudience = {
  label: string;
  included: AudienceCustomer[];
  excludedOptOut: AudienceCustomer[];
  excludedUnreachable: AudienceCustomer[];
  totalMatched: number;
  capped: boolean;
};

export async function resolveAudience(input: {
  organizationId: string;
  audienceType: MarketingAudienceType;
  config: AudienceConfig;
  now?: Date;
}): Promise<ResolvedAudience> {
  const now = input.now ?? new Date();
  const plan = buildAudiencePlan(input.audienceType, input.config, now);

  const rows = await prisma.customer.findMany({
    where: { organizationId: input.organizationId, ...plan.where },
    orderBy: { displayName: "asc" },
    take: AUDIENCE_HARD_CAP + 1,
    select: {
      id: true,
      displayName: true,
      phone: true,
      marketingOptIn: true,
      marketingOptOutAt: true,
      status: true,
      area: true,
      city: true,
    },
  });

  const capped = rows.length > AUDIENCE_HARD_CAP;
  let matched: AudienceCustomer[] = rows.slice(0, AUDIENCE_HARD_CAP);

  // Post-filtre : dépense totale minimale (commandes livrées).
  if (plan.needsPostFilter && input.config.minSpent != null && matched.length > 0) {
    const minSpent = input.config.minSpent;
    const spendRows = await prisma.order.groupBy({
      by: ["customerId"],
      where: {
        organizationId: input.organizationId,
        status: "DELIVERED",
        customerId: { in: matched.map((m) => m.id) },
      },
      _sum: { totalAmount: true },
    });
    const spent = new Map(spendRows.map((r) => [r.customerId, r._sum.totalAmount ?? 0]));
    matched = matched.filter((m) => (spent.get(m.id) ?? 0) >= minSpent);
  }

  const split = splitAudienceByConsent(matched);
  return {
    label: plan.label,
    included: split.included,
    excludedOptOut: split.excludedOptOut,
    excludedUnreachable: split.excludedUnreachable,
    totalMatched: matched.length,
    capped,
  };
}
