import { test } from "node:test";

/**
 * Tests d'INTÉGRATION Djeli Learning Loop. Nécessitent PostgreSQL :
 *   RUN_DB_TESTS=1 DATABASE_URL=postgres://… npm test
 *
 * Scénarios attendus (§51–§61, §63) :
 *
 *  §51 ORGANIZATION — 3 corrections identiques dans Org A uniquement →
 *      recompute crée un LearningCandidate scopeSuggestion=ORGANIZATION,
 *      jamais DOMAIN/GLOBAL.
 *
 *  §52 DOMAIN — même correction dans ≥ 3 organisations du domaine commerce →
 *      scopeSuggestion=DOMAIN(commerce), requiresStrongReview=true.
 *
 *  §53 GLOBAL SAFETY — 100 occurrences mais correction non anonymisable
 *      (sanitizedText null) → shareable=false → scopeSuggestion=ORGANIZATION,
 *      jamais GLOBAL.
 *
 *  §54 DUPLICATE — recomputeLearningCandidates() lancé 2× → même dedupeKey,
 *      pas de doublon, occurrenceCount/correctionCount cohérents.
 *
 *  §55 PII — correction contenant téléphone + nom non masquable →
 *      sanitizedText null (observation-service) → candidat non partageable.
 *
 *  §56 PROMOTION — candidate APPROVED → promoteLearningCandidate() crée une
 *      LanguageEntry status SUGGESTED ; resolve standard NE l'utilise pas.
 *      Après validateEntry (permission séparée) → resolve l'utilise.
 *
 *  §57 PRIORITY — une entrée ORGANIZATION VALIDATED continue de battre
 *      DOMAIN/GLOBAL après passage du Learning Loop (ordre inchangé).
 *
 *  §58 CONFLICT — candidat dont la forme canonique existe déjà (sens différent
 *      ou entrée VALIDATED) → status CONFLICT, conflictEntryId renseigné,
 *      promoteLearningCandidate() refuse (aucune fusion auto).
 *
 *  §59 RBAC — client API avec language.write mais sans language.review →
 *      403 sur approve/reject/promote/recompute. Reviewer (language.review) → OK.
 *      Validation finale d'entrée reste language.validate.
 *
 *  §60 TENANT — Org A ne voit pas les observations / candidats ORGANIZATION
 *      d'Org B (organizationId scoping + hash côté preuve).
 *
 *  §61 EXPORT — buildLearningDataset() ne renvoie que des candidats
 *      APPROVED/PROMOTED shareable, texte ré-anonymisé, sans PII.
 *
 *  §63 INVARIANT — aucune donnée ne devient GLOBAL VALIDATED automatiquement :
 *      promoteLearningCandidate() vise toujours SUGGESTED (assertPromotionStatus).
 *
 * Garanties déjà couvertes sans DB :
 *  - `calculateCandidateScore` / `explainScore` : bornés, déterministes, lisibles.
 *  - `suggestScope` : 1 org → ORGANIZATION, non-shareable → ORGANIZATION,
 *    GLOBAL seulement multi-domaines + forte diversité.
 *  - `candidateDedupeKey` : stable, org-agnostique pour GLOBAL/DOMAIN.
 *  - `assertPromotionStatus` : rejette VALIDATED / GLOBAL / OBSERVED.
 *  - `submitObservation` : idempotencyKey → pas de doublon sur retry.
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";

test("intégration Djeli Learning Loop (nécessite RUN_DB_TESTS + DB)", { skip: !RUN }, () => {
  throw new Error(
    "Brancher ici recomputeLearningCandidates / approveCandidate / promoteLearningCandidate / buildLearningDataset sur une base de test.",
  );
});
