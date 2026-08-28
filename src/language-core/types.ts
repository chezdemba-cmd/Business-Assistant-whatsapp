import type { LanguageCode, LanguageScope } from "@prisma/client";

/** Réponse de POST /resolve — contrat stable pour toutes les applications Djeli. */
export type ResolveResult = {
  matched: boolean;
  matchType: "EXACT" | "VARIANT" | "FUZZY" | "NONE";
  entryId: string | null;
  canonicalText: string | null;
  language: LanguageCode | null;
  scope: LanguageScope | null;
  domainCode: string | null;
  meaning: string | null;
  translations: Array<{ language: LanguageCode; text: string }>;
  variants: Array<{ text: string; variantType: string }>;
  intentMappings: Array<{ intentCode: string; confidence: number | null }>;
  status: string | null;
  confidence: number | null;
};

export const EMPTY_RESOLVE: ResolveResult = {
  matched: false,
  matchType: "NONE",
  entryId: null,
  canonicalText: null,
  language: null,
  scope: null,
  domainCode: null,
  meaning: null,
  translations: [],
  variants: [],
  intentMappings: [],
  status: null,
  confidence: null,
};
