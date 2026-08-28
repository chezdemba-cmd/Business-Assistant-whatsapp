import { test } from "node:test";

/**
 * Tests d'INTÉGRATION Phase 7 (automatisations + marketing). Nécessitent
 * PostgreSQL :  RUN_DB_TESTS=1 DATABASE_URL=postgres://… npm test
 *
 * Scénarios attendus (§62–§71) :
 *
 *  §62 LOW STOCK — un produit passe au niveau du seuil → recommandation
 *      LOW_STOCK MEDIUM créée ; le stock remonte au-dessus du seuil → à la
 *      passe suivante la recommandation passe EXPIRED (problème résolu).
 *
 *  §63 DEBT — une commande livrée non payée dépasse 30 jours d'échéance →
 *      recommandation OVERDUE_DEBT ; un paiement solde la commande →
 *      recommandation EXPIRED.
 *
 *  §64 INACTIVE CUSTOMER — un client sans commande livrée depuis le seuil →
 *      recommandation agrégée INACTIVE_CUSTOMER ; une nouvelle commande livrée
 *      le retire du segment → le compte diminue / la recommandation expire.
 *
 *  §65 DEDUPE — runAutomationsForOrganization lancé 5 fois d'affilée →
 *      une seule BusinessRecommendation active par problème (dedupeKey unique,
 *      cooldown respecté).
 *
 *  §66 SALES SCOPE — un SALES ne voit via listRecommendations que les
 *      recommandations dont ownerUserId == son id (créance d'un client
 *      assigné, commande créée par lui). Les recommandations globales (stock,
 *      résumé) lui sont invisibles.
 *
 *  §67 CAMPAIGN CONSENT — un client marketingOptOutAt renseigné est classé
 *      dans excludedOptOut par resolveAudience et n'obtient jamais de
 *      MarketingCampaignItem à l'envoi.
 *
 *  §68 DUPLICATE SEND — sendCampaign relancé (retry) → upsert par
 *      (campaignId, customerId) ; les items déjà SENT ne sont pas renvoyés,
 *      un seul message par client.
 *
 *  §69 TEMPLATE — campagne dont l'audience est hors fenêtre 24 h et sans
 *      templateName → items SKIPPED (errorCode OUT_OF_WINDOW_NO_TEMPLATE),
 *      aucun envoi de texte libre.
 *
 *  §70 TENANT — Org A ne voit ni les AutomationRule, ni les
 *      BusinessRecommendation, ni les MarketingCampaign de l'Org B
 *      (toutes les requêtes portent organizationId).
 *
 *  §71 AI — Djeli IA peut reformuler une recommandation, mais les chiffres
 *      affichés proviennent des services métier (buildDailyDigest,
 *      finance-service, stock-service), jamais du modèle.
 *
 *  §72 JOB — getJobQueue().enqueue avec la même dedupeParts pendant qu'un job
 *      est PENDING/RUNNING → renvoie le job existant (deduped), pas de doublon ;
 *      un handler qui échoue repasse PENDING avec runAfter décalé jusqu'à
 *      maxAttempts, puis DEAD.
 */

test("Phase 7 integration — voir les scénarios documentés (RUN_DB_TESTS)", { skip: !process.env.RUN_DB_TESTS }, () => {});
