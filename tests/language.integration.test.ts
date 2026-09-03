import { test } from "node:test";

/**
 * Tests d'INTÉGRATION Djeli Language Core. Nécessitent PostgreSQL :
 *   RUN_DB_TESTS=1 DATABASE_URL=postgres://… npm test
 *
 * Scénarios attendus (§50–§58) :
 *
 *  §50 GLOBAL — entrée GLOBAL BM VALIDATED : toute application autorisée (scope
 *      GLOBAL) la résout via /resolve.
 *
 *  §51 DOMAIN — entrée DOMAIN commerce : une application « commerce » la voit ;
 *      une application sans ce domaine dans allowedDomains → 403 sur /resolve
 *      avec domain=commerce, et l'entrée n'apparaît pas.
 *
 *  §52 ORGANIZATION — Org A crée une variante privée : resolve avec
 *      organizationId=A la renvoie ; avec organizationId=B jamais.
 *
 *  §53 PRIORITÉ — même normalizedText : GLOBAL=sens A, DOMAIN commerce=sens B,
 *      ORG A=sens C. resolve(org A, commerce) → C ; resolve(org B, commerce) →
 *      B ; resolve(autre domaine) → A.
 *
 *  §54 STATUS — OBSERVED / SUGGESTED / REJECTED / ARCHIVED : jamais servis par
 *      un resolve standard (seul VALIDATED).
 *
 *  §55 CORRECTION — languageCore.submitCorrection(original, corrected) crée
 *      LanguageObservation + LanguageCorrection ; AUCUNE LanguageEntry GLOBAL
 *      créée. La transcription vocale corrigée (Phase 6B) déclenche cet appel.
 *
 *  §56 ANONYMISATION — une correction contenant nom + téléphone + CMD-xxxx :
 *      `sanitizedText` masque tel/ref/email ; si risque résiduel, `sanitizedText`
 *      reste null (non partageable).
 *
 *  §57 API AUTH — client invalide → 401 ; client valide sans la permission
 *      demandée (ex. language.validate) → 403.
 *
 *  §58 EXPORT — GET /exports (défaut GLOBAL+DOMAIN, VALIDATED) : aucune entrée
 *      ORGANIZATION, aucune observation brute, aucune PII (sanitizeLearningData
 *      appliqué à chaque champ).
 *
 * Garanties déjà couvertes sans DB :
 *  - `normalizeText` conserve les diacritiques bambara.
 *  - `resolutionOrder` : ORG → DOMAIN → GLOBAL, filtré par allowedScopes.
 *  - `sanitizeLearningData` : masque email / tel / réf / nombres longs.
 *  - `permissions` : le connecteur Business n'a jamais `language.validate`.
 *  - `languageCore.*` : try/catch → fallback (le Business Assistant continue).
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";

test(
  "intégration Djeli Language Core (nécessite RUN_DB_TESTS + DB)",
  {
    skip: !RUN,
    todo: "À implémenter : resolveExpression / searchEntries / buildExport / API auth sur une base de test.",
  },
  () => {},
);
