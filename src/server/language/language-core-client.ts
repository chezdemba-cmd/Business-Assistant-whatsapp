import "server-only";
import type { LanguageCode } from "@prisma/client";
import { logError } from "@/server/errors";
import { recordUsage } from "@/server/billing/usage-service";
import { resolveExpression } from "@/language-core/resolve-engine";
import { searchEntries } from "@/language-core/search-service";
import {
  submitObservation,
  submitCorrection,
} from "@/language-core/observation-service";
import { EMPTY_RESOLVE, type ResolveResult } from "@/language-core/types";

/**
 * Connecteur Business Assistant ↔ Djeli Language Core.
 *
 * INTERFACE STABLE (aujourd'hui appel in-process, demain HTTP `/api/v1/language`
 * sans changer les appelants). TOLÉRANT AUX PANNES : si le Core échoue, chaque
 * méthode renvoie un résultat neutre et le Business Assistant continue (§30) —
 * le pipeline Voice / Djeli IA existant reste la référence.
 */

const APP_CODE = "DJELI_BUSINESS";
const DEFAULT_DOMAIN = "commerce";

export const languageCore = {
  /** Enrichissement LECTURE. Ne jette jamais. */
  async resolveExpression(input: {
    text: string;
    language?: LanguageCode | null;
    domainCode?: string | null;
    organizationId?: string | null;
    context?: string | null;
  }): Promise<ResolveResult> {
    if (input.organizationId) {
      // Metering best-effort (§14) — n'altère jamais la tolérance aux pannes.
      void recordUsage(input.organizationId, "LANGUAGE_RESOLVES", 1, "UTC");
    }
    try {
      return await resolveExpression({
        text: input.text,
        language: input.language ?? null,
        domainCode: input.domainCode ?? DEFAULT_DOMAIN,
        organizationId: input.organizationId ?? null,
        context: input.context ?? null,
        applicationCode: APP_CODE,
        ctx: {
          organizationId: input.organizationId ?? null,
          domainCode: input.domainCode ?? DEFAULT_DOMAIN,
          allowedScopes: ["ORGANIZATION", "DOMAIN", "GLOBAL"],
        },
      });
    } catch (error) {
      logError("languageCore.resolveExpression", error);
      return EMPTY_RESOLVE;
    }
  },

  async searchLanguageEntry(input: {
    query: string;
    language?: LanguageCode | null;
    organizationId?: string | null;
    domainCode?: string | null;
  }) {
    try {
      return await searchEntries({
        query: input.query,
        language: input.language ?? null,
        organizationId: input.organizationId ?? null,
        domainCode: input.domainCode ?? DEFAULT_DOMAIN,
        allowedScopes: ["ORGANIZATION", "DOMAIN", "GLOBAL"],
      });
    } catch (error) {
      logError("languageCore.searchLanguageEntry", error);
      return [];
    }
  },

  /** Soumission d'observation — zone candidate, jamais GLOBAL. Ne jette jamais. */
  async submitObservation(input: {
    originalText: string;
    detectedLanguage?: LanguageCode;
    organizationId?: string | null;
    domainCode?: string | null;
    contextType?: string | null;
    sourceReference?: string | null;
    resolvedMatchType?: string | null;
  }): Promise<void> {
    try {
      await submitObservation({
        applicationCode: APP_CODE,
        organizationId: input.organizationId ?? null,
        domainCode: input.domainCode ?? DEFAULT_DOMAIN,
        originalText: input.originalText,
        detectedLanguage: input.detectedLanguage,
        contextType: input.contextType ?? null,
        sourceReference: input.sourceReference ?? null,
        resolvedMatchType: input.resolvedMatchType ?? null,
      });
    } catch (error) {
      logError("languageCore.submitObservation", error);
    }
  },

  /** Soumission d'une correction humaine — matière du futur Learning Loop. */
  async submitCorrection(input: {
    originalText: string;
    correctedText: string;
    detectedLanguage?: LanguageCode;
    organizationId?: string | null;
    domainCode?: string | null;
    context?: string | null;
    correctedByRef?: string | null;
    sourceReference?: string | null;
  }): Promise<void> {
    try {
      await submitCorrection({
        applicationCode: APP_CODE,
        organizationId: input.organizationId ?? null,
        domainCode: input.domainCode ?? DEFAULT_DOMAIN,
        originalText: input.originalText,
        correctedText: input.correctedText,
        detectedLanguage: input.detectedLanguage,
        context: input.context ?? "voice-correction",
        contextType: "voice",
        sourceReference: input.sourceReference ?? null,
        correctedByRef: input.correctedByRef ?? null,
      });
    } catch (error) {
      logError("languageCore.submitCorrection", error);
    }
  },
};
