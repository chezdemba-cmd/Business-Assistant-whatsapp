import "server-only";
import type { LanguageCode, LanguageScope, Prisma } from "@prisma/client";
import { lcDb } from "./db";
import { normalizeText } from "./normalize";

export type SearchInput = {
  query: string;
  language?: LanguageCode | null;
  domainCode?: string | null;
  organizationId?: string | null;
  allowedScopes: LanguageScope[];
  /** Inclure les non-validées (usage admin uniquement). */
  includeUnvalidated?: boolean;
  limit?: number;
};

/** Recherche sur canonicalText / normalizedText / variantes / traductions. */
export async function searchEntries(input: SearchInput) {
  const q = normalizeText(input.query);
  if (!q) return [];
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));

  const scopeOr: Prisma.LanguageEntryWhereInput[] = [];
  if (input.allowedScopes.includes("GLOBAL")) scopeOr.push({ scope: "GLOBAL" });
  if (input.allowedScopes.includes("DOMAIN")) {
    scopeOr.push({ scope: "DOMAIN", ...(input.domainCode ? { domainCode: input.domainCode } : {}) });
  }
  if (input.allowedScopes.includes("ORGANIZATION") && input.organizationId) {
    scopeOr.push({ scope: "ORGANIZATION", organizationId: input.organizationId });
  }
  if (scopeOr.length === 0) return [];

  return lcDb.languageEntry.findMany({
    where: {
      archivedAt: null,
      ...(input.includeUnvalidated
        ? {}
        : { status: "VALIDATED" }),
      AND: [
        { OR: scopeOr },
        ...(input.language ? [{ language: input.language }] : []),
        {
          OR: [
            { normalizedText: { contains: q } },
            { canonicalText: { contains: input.query, mode: "insensitive" } },
            { meaning: { contains: input.query, mode: "insensitive" } },
            { variants: { some: { normalizedText: { contains: q } } } },
            { translations: { some: { text: { contains: input.query, mode: "insensitive" } } } },
          ],
        },
      ],
    },
    orderBy: [{ status: "asc" }, { normalizedText: "asc" }],
    take: limit,
    include: {
      variants: true,
      translations: true,
      intentMappings: true,
    },
  });
}
