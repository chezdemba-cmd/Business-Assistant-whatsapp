import "server-only";
import type { LanguageCode, Prisma } from "@prisma/client";
import { lcDb } from "./db";
import { logError } from "@/server/errors";
import { normalizeText } from "./normalize";
import { resolutionOrder, type ResolveContext } from "./scope-priority";
import { EMPTY_RESOLVE, type ResolveResult } from "./types";

const ENTRY_INCLUDE = {
  translations: { where: { status: "VALIDATED" as const } },
  variants: { where: { status: { in: ["VALIDATED", "SUGGESTED"] as const } } },
  intentMappings: { where: { status: "VALIDATED" as const } },
} satisfies Prisma.LanguageEntryInclude;

type EntryWith = Prisma.LanguageEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>;

function shape(
  entry: EntryWith,
  matchType: ResolveResult["matchType"],
): ResolveResult {
  return {
    matched: true,
    matchType,
    entryId: entry.id,
    canonicalText: entry.canonicalText,
    language: entry.language,
    scope: entry.scope,
    domainCode: entry.domainCode,
    meaning: entry.meaning,
    translations: entry.translations.map((t) => ({ language: t.language, text: t.text })),
    variants: entry.variants.map((v) => ({ text: v.text, variantType: v.variantType })),
    intentMappings: entry.intentMappings.map((m) => ({
      intentCode: m.intentCode,
      confidence: m.confidence,
    })),
    status: entry.status,
    confidence: entry.confidence,
  };
}

export type ResolveInput = {
  text: string;
  language?: LanguageCode | null;
  domainCode?: string | null;
  organizationId?: string | null;
  context?: string | null;
  ctx: ResolveContext;
  applicationCode?: string;
};

/**
 * Moteur de résolution : priorité ORGANIZATION → DOMAIN → GLOBAL, puis
 * exact → variante → fuzzy. Ne sert QUE des entrées VALIDATED non archivées.
 */
export async function resolveExpression(input: ResolveInput): Promise<ResolveResult> {
  const started = Date.now();
  const needle = normalizeText(input.text);
  if (!needle) return EMPTY_RESOLVE;

  const langFilter = input.language ? { language: input.language } : {};
  const order = resolutionOrder(input.ctx);
  let result: ResolveResult = EMPTY_RESOLVE;

  outer: for (const q of order) {
    const base: Prisma.LanguageEntryWhereInput = {
      status: "VALIDATED",
      archivedAt: null,
      scope: q.scope,
      organizationId: q.organizationId,
      domainCode: q.domainCode,
      ...langFilter,
    };

    // 1. exact
    const exact = await lcDb.languageEntry.findFirst({
      where: { ...base, normalizedText: needle },
      include: ENTRY_INCLUDE,
    });
    if (exact) {
      result = shape(exact, "EXACT");
      break outer;
    }

    // 2. variante exacte
    const viaVariant = await lcDb.languageEntry.findFirst({
      where: {
        ...base,
        variants: {
          some: {
            normalizedText: needle,
            status: { in: ["VALIDATED", "SUGGESTED"] },
          },
        },
      },
      include: ENTRY_INCLUDE,
    });
    if (viaVariant) {
      result = shape(viaVariant, "VARIANT");
      break outer;
    }
  }

  // 3. fuzzy raisonnable (contains), en respectant l'ordre de scope
  if (!result.matched && needle.length >= 3) {
    for (const q of order) {
      const fuzzy = await lcDb.languageEntry.findFirst({
        where: {
          status: "VALIDATED",
          archivedAt: null,
          scope: q.scope,
          organizationId: q.organizationId,
          domainCode: q.domainCode,
          ...langFilter,
          OR: [
            { normalizedText: { contains: needle } },
            { variants: { some: { normalizedText: { contains: needle } } } },
          ],
        },
        orderBy: { normalizedText: "asc" },
        include: ENTRY_INCLUDE,
      });
      if (fuzzy) {
        result = shape(fuzzy, "FUZZY");
        break;
      }
    }
  }

  void recordMetric({
    applicationCode: input.applicationCode ?? "-",
    domainCode: input.domainCode ?? "-",
    language: input.language ?? "OTHER",
    matched: result.matched,
    latencyMs: Date.now() - started,
  });

  return result;
}

async function recordMetric(m: {
  applicationCode: string;
  domainCode: string;
  language: LanguageCode;
  matched: boolean;
  latencyMs: number;
}): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  try {
    await lcDb.languageResolveMetric.upsert({
      where: {
        day_applicationCode_domainCode_language: {
          day,
          applicationCode: m.applicationCode,
          domainCode: m.domainCode,
          language: m.language,
        },
      },
      create: {
        day,
        applicationCode: m.applicationCode,
        domainCode: m.domainCode,
        language: m.language,
        resolveCount: 1,
        matchCount: m.matched ? 1 : 0,
        noMatchCount: m.matched ? 0 : 1,
        totalLatencyMs: m.latencyMs,
      },
      update: {
        resolveCount: { increment: 1 },
        matchCount: { increment: m.matched ? 1 : 0 },
        noMatchCount: { increment: m.matched ? 0 : 1 },
        totalLatencyMs: { increment: m.latencyMs },
      },
    });
  } catch (error) {
    logError("language-core.metric", error);
  }
}
