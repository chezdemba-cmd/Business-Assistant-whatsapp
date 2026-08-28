import "server-only";
import { Prisma, type LanguageCode, type LanguageConsentStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { lcDb } from "./db";
import { normalizeText } from "./normalize";
import { sanitizeLearningData } from "./sanitize";
import { lcAudit } from "./audit";

/** Clé d'idempotence : mêmes app + organisation + référence source → une observation (§49). */
function idempotencyKeyOf(input: {
  applicationCode: string;
  organizationId?: string | null;
  sourceReference?: string | null;
}): string | null {
  if (!input.sourceReference) return null;
  return createHash("sha256")
    .update(`${input.applicationCode}|${input.organizationId ?? "-"}|${input.sourceReference}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Occurrences & corrections — MATIÈRE PREMIÈRE. Jamais de promotion automatique
 * vers une `LanguageEntry` GLOBAL VALIDATED (§35). La Phase 6D décidera de
 * l'agrégation.
 */

export type SubmitObservationInput = {
  applicationCode: string;
  organizationId?: string | null;
  domainCode?: string | null;
  originalText: string;
  detectedLanguage?: LanguageCode;
  contextType?: string | null;
  sourceReference?: string | null;
  /** Résultat du resolve au moment de l'observation ("NONE" = non reconnu). */
  resolvedMatchType?: string | null;
  retentionUntil?: Date | null;
};

export async function submitObservation(input: SubmitObservationInput) {
  const idempotencyKey = idempotencyKeyOf(input);
  if (idempotencyKey) {
    const dupe = await lcDb.languageObservation.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (dupe) return dupe; // §49 : pas de doublon sur retry
  }

  let obs: { id: string };
  try {
    obs = await lcDb.languageObservation.create({
      data: {
        applicationCode: input.applicationCode,
        organizationId: input.organizationId ?? null,
        domainCode: input.domainCode ?? null,
        originalText: input.originalText.slice(0, 2000),
        normalizedText: normalizeText(input.originalText).slice(0, 2000),
        detectedLanguage: input.detectedLanguage ?? "OTHER",
        contextType: input.contextType ?? null,
        sourceReference: input.sourceReference ?? null,
        idempotencyKey,
        resolvedMatchType: input.resolvedMatchType ?? null,
        retentionUntil: input.retentionUntil ?? null,
        status: "NEW",
      },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && idempotencyKey) {
      const again = await lcDb.languageObservation.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (again) return again;
    }
    throw e;
  }
  await lcAudit({
    action: "OBSERVATION_SUBMITTED",
    entityType: "language_observation",
    entityId: obs.id,
    applicationCode: input.applicationCode,
    metadata: { domainCode: input.domainCode ?? null, language: input.detectedLanguage ?? "OTHER" },
  });
  return obs;
}

export type SubmitCorrectionInput = SubmitObservationInput & {
  correctedText: string;
  correctedByRef?: string | null;
  context?: string | null;
  consentStatus?: LanguageConsentStatus;
};

/**
 * Crée une observation + sa correction. Stocke aussi une version anonymisée
 * (`sanitizedText`) destinée à un futur corpus partagé — sans PII.
 */
export async function submitCorrection(input: SubmitCorrectionInput) {
  const observation = await submitObservation(input);
  const sanitized = sanitizeLearningData(input.correctedText);

  const correction = await lcDb.languageCorrection.create({
    data: {
      observationId: observation.id,
      originalText: input.originalText.slice(0, 2000),
      correctedText: input.correctedText.slice(0, 2000),
      correctedByRef: input.correctedByRef ?? null,
      detectedLanguage: input.detectedLanguage ?? "OTHER",
      context: input.context ?? input.contextType ?? null,
      consentStatus: input.consentStatus ?? "UNKNOWN",
      // Si le texte anonymisé garde un risque, on NE le propose pas au partage.
      sanitizedText: sanitized.residualRisk ? null : sanitized.text,
    },
    select: { id: true },
  });

  await lcDb.languageObservation.update({
    where: { id: observation.id },
    data: { status: "LINKED" },
  });
  await lcAudit({
    action: "CORRECTION_SUBMITTED",
    entityType: "language_correction",
    entityId: correction.id,
    applicationCode: input.applicationCode,
    metadata: {
      redacted: sanitized.redacted,
      shareable: !sanitized.residualRisk,
    },
  });

  return { observationId: observation.id, correctionId: correction.id };
}
