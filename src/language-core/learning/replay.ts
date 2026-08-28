import "server-only";
import { lcDb } from "../db";
import { normalizeText } from "../normalize";
import { resolveExpression } from "../resolve-engine";

/**
 * REPLAY (§39) : simule l'impact d'un candidat avant validation. Pour chaque
 * échantillon, on compare la résolution ACTUELLE (Language Core) et ce que
 * donnerait le candidat s'il devenait une connaissance. Simple et lisible —
 * pas un moteur d'évaluation complet.
 */
export async function replayCandidate(input: {
  candidateId: string;
  samples: string[];
}): Promise<{
  candidateId: string;
  results: Array<{
    sample: string;
    currentMatch: boolean;
    currentCanonical: string | null;
    wouldMatchCandidate: boolean;
  }>;
}> {
  const c = await lcDb.learningCandidate.findUnique({ where: { id: input.candidateId } });
  if (!c) return { candidateId: input.candidateId, results: [] };

  const candNorm = normalizeText(c.canonicalText);
  const patternNorm = c.originalPattern ? normalizeText(c.originalPattern) : null;

  const results = [];
  for (const sample of input.samples.slice(0, 20)) {
    const n = normalizeText(sample);
    const current = await resolveExpression({
      text: sample,
      domainCode: c.domainCode,
      organizationId: c.scopeSuggestion === "ORGANIZATION" ? c.organizationId : null,
      ctx: {
        organizationId: c.scopeSuggestion === "ORGANIZATION" ? c.organizationId : null,
        domainCode: c.domainCode,
        allowedScopes: ["ORGANIZATION", "DOMAIN", "GLOBAL"],
      },
    });
    const wouldMatch =
      n === candNorm ||
      n === patternNorm ||
      (candNorm.length >= 3 && n.includes(candNorm)) ||
      (patternNorm != null && patternNorm.length >= 3 && n.includes(patternNorm));
    results.push({
      sample,
      currentMatch: current.matched,
      currentCanonical: current.canonicalText,
      wouldMatchCandidate: Boolean(wouldMatch),
    });
  }
  return { candidateId: input.candidateId, results };
}
