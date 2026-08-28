import type { MarketingAudienceType, Prisma } from "@prisma/client";

/**
 * Traduction d'un type d'audience + config en fragment `where` Prisma (côté
 * clients) — PUR (§23, §47). Critères simples uniquement : inactivité, type de
 * client, zone, produit acheté. Aucune segmentation ML.
 *
 * Le filtre de CONSENTEMENT (opt-out) n'est PAS ajouté ici : il est appliqué
 * systématiquement par la couche service via `marketing/consent.ts`, pour qu'il
 * soit impossible de l'oublier.
 */

export type AudienceConfig = {
  /** INACTIVE_CUSTOMERS : sans commande livrée depuis N jours. */
  inactiveDays?: number;
  /** CUSTOMER_TYPE : RETAIL / WHOLESALE / … (valeur de l'enum CustomerType). */
  customerType?: string;
  /** AREA : quartier / zone (correspondance insensible à la casse). */
  area?: string;
  /** PRODUCT_BUYERS : id produit acheté au moins une fois (commande livrée). */
  productId?: string;
  /** Filtre optionnel commun : dépense totale minimale (commandes livrées). */
  minSpent?: number;
};

export type AudiencePlan = {
  /** `where` partiel à combiner avec `{ organizationId }`. */
  where: Prisma.CustomerWhereInput;
  /** true si l'audience exige un post-filtrage en mémoire (dépense, inactivité fine). */
  needsPostFilter: boolean;
  /** Description lisible pour l'aperçu. */
  label: string;
};

export function buildAudiencePlan(
  type: MarketingAudienceType,
  config: AudienceConfig,
  now: Date,
): AudiencePlan {
  const base: Prisma.CustomerWhereInput = { status: "ACTIVE" };

  switch (type) {
    case "INACTIVE_CUSTOMERS": {
      const days = clampInt(config.inactiveDays ?? 60, 1, 3650);
      const cutoff = new Date(now.getTime() - days * 86_400_000);
      return {
        where: {
          ...base,
          orders: {
            some: { status: "DELIVERED" },
            none: { status: "DELIVERED", deliveredAt: { gte: cutoff } },
          },
        },
        needsPostFilter: config.minSpent != null,
        label: `Clients sans commande livrée depuis ${days} jours`,
      };
    }
    case "CUSTOMER_TYPE": {
      const t = (config.customerType ?? "").trim();
      return {
        where: { ...base, ...(t ? { customerType: t as never } : {}) },
        needsPostFilter: config.minSpent != null,
        label: t ? `Clients de type ${t}` : "Tous les clients (type non précisé)",
      };
    }
    case "AREA": {
      const a = (config.area ?? "").trim();
      return {
        where: {
          ...base,
          ...(a
            ? { OR: [{ area: { equals: a, mode: "insensitive" } }, { city: { equals: a, mode: "insensitive" } }] }
            : {}),
        },
        needsPostFilter: config.minSpent != null,
        label: a ? `Clients de la zone « ${a} »` : "Zone non précisée",
      };
    }
    case "PRODUCT_BUYERS": {
      const pid = (config.productId ?? "").trim();
      return {
        where: {
          ...base,
          ...(pid
            ? { orders: { some: { status: "DELIVERED", items: { some: { productId: pid } } } } }
            : {}),
        },
        needsPostFilter: config.minSpent != null,
        label: pid ? "Clients ayant déjà acheté ce produit" : "Produit non précisé",
      };
    }
    case "ALL_OPTED_IN": {
      return {
        where: { ...base },
        needsPostFilter: config.minSpent != null,
        label: "Tous les clients ayant accepté le marketing",
      };
    }
    case "CUSTOM":
    default:
      return {
        where: { ...base },
        needsPostFilter: false,
        label: "Audience personnalisée",
      };
  }
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
