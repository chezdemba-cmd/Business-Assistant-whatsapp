import "server-only";
import type { LanguageCode, LanguageScope } from "@prisma/client";
import { lcDb } from "../db";

/**
 * Détection de conflit AVANT promotion (§40, §58) : existe-t-il déjà une
 * `LanguageEntry` non archivée avec le même `normalizedText` dans le même
 * scope/domaine/organisation, dont le sens diffère ? On ne fusionne JAMAIS
 * automatiquement — on renvoie l'entrée en conflit pour revue manuelle.
 */
export async function detectEntryConflict(input: {
  normalizedText: string;
  language: LanguageCode;
  scope: LanguageScope;
  domainCode: string | null;
  organizationId: string | null;
  proposedMeaning?: string | null;
}): Promise<{ conflict: boolean; entryId: string | null }> {
  const existing = await lcDb.languageEntry.findFirst({
    where: {
      normalizedText: input.normalizedText,
      language: input.language,
      scope: input.scope,
      domainCode: input.domainCode,
      organizationId: input.organizationId,
      archivedAt: null,
    },
    select: { id: true, meaning: true, status: true },
  });
  if (!existing) return { conflict: false, entryId: null };

  // Même forme déjà connue : conflit si le sens proposé diffère nettement,
  // ou si l'entrée existante est déjà VALIDATED (toute reprise passe par revue).
  const meaningDiffers =
    Boolean(input.proposedMeaning) &&
    Boolean(existing.meaning) &&
    input.proposedMeaning!.trim().toLowerCase() !== existing.meaning!.trim().toLowerCase();

  return {
    conflict: meaningDiffers || existing.status === "VALIDATED",
    entryId: existing.id,
  };
}
