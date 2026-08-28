import type { LanguageScope } from "@prisma/client";

/**
 * Priorité de résolution — PUR.
 *   1. correspondance exacte ORGANIZATION (de l'appelant)
 *   2. variante ORGANIZATION
 *   3. DOMAIN (domaine demandé)
 *   4. GLOBAL
 *   5. fuzzy raisonnable
 * Les statuts REJECTED / ARCHIVED / OBSERVED / SUGGESTED ne sont jamais servis
 * par un `resolve` standard.
 */

export type ResolveContext = {
  organizationId?: string | null;
  domainCode?: string | null;
  /** Scopes que l'application appelante a le droit de lire. */
  allowedScopes: LanguageScope[];
};

export type ScopeQuery = {
  scope: LanguageScope;
  organizationId: string | null;
  domainCode: string | null;
  rank: number;
};

/** Ordre des requêtes de scope à tenter, du plus spécifique au plus général. */
export function resolutionOrder(ctx: ResolveContext): ScopeQuery[] {
  const out: ScopeQuery[] = [];
  const can = (s: LanguageScope) => ctx.allowedScopes.includes(s);

  if (ctx.organizationId && can("ORGANIZATION")) {
    out.push({
      scope: "ORGANIZATION",
      organizationId: ctx.organizationId,
      domainCode: null,
      rank: 1,
    });
  }
  if (ctx.domainCode && can("DOMAIN")) {
    out.push({
      scope: "DOMAIN",
      organizationId: null,
      domainCode: ctx.domainCode,
      rank: 3,
    });
  }
  if (can("GLOBAL")) {
    out.push({ scope: "GLOBAL", organizationId: null, domainCode: null, rank: 4 });
  }
  return out;
}

export const RESOLVABLE_STATUSES = ["VALIDATED"] as const;
