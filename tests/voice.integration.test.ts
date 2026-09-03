import { test } from "node:test";

/**
 * Tests d'INTÉGRATION Djeli Voice. Nécessitent PostgreSQL :
 *   RUN_DB_TESTS=1 DATABASE_URL=postgres://… npm test
 *
 * Scénarios attendus (§45–§54) :
 *
 *  §45 FR — Message AUDIO inbound, provider mock renvoie « Je veux six sacs de
 *      sucre » → VoiceTranscription COMPLETED, detectedLanguage FR,
 *      effectiveText = originalText ; conversation AUTO → AiRun (OrderDraft
 *      potentiel via le pipeline IA existant).
 *
 *  §46 BM — audio bambara → detectedLanguage BM, texte conservé tel quel,
 *      transmis à Djeli IA sans traduction forcée.
 *
 *  §47 MIXED — « N b'a fɛ, ajoute-moi 2 cartons de lait » → detectedLanguage
 *      MIXED, aucune normalisation destructive (originalText intact).
 *
 *  §48 Correction — correctTranscription(« six sacs de sucre ») →
 *      status CORRECTED, originalText inchangé, effectiveText = correctedText,
 *      AuditLog VOICE_TRANSCRIPTION_CORRECTED.
 *
 *  §49 Tenant — Org A ne peut ni lire, ni corriger, ni retranscrire une
 *      VoiceTranscription d'Org B ; aucune récupération d'audio inter-org.
 *
 *  §50 AUTO — conversation AUTO + audio → transcription puis AiRun
 *      (WHATSAPP_AUTO_REPLY) déclenché par transcribeMessage.
 *
 *  §51 HUMAN — conversation HUMAN + audio → transcription réalisée et visible,
 *      AUCUN AiRun automatique.
 *
 *  §52 Confiance basse — confidence < VOICE_LOW_CONFIDENCE_THRESHOLD →
 *      handoff (mode HUMAN) + message de clarification, AUCUN OrderDraft ni
 *      action sensible.
 *
 *  §53 Duplicate — même Message AUDIO redélivré par Meta → une seule
 *      VoiceTranscription (unique messageId) ; retranscription seulement sur
 *      action explicite (« Réessayer »).
 *
 *  §54 Échec — provider timeout → VoiceTranscription FAILED (errorCode),
 *      webhook déjà 200, aucune réponse IA fantôme, bouton « Réessayer ».
 *
 * Garanties déjà couvertes sans DB :
 *  - `detectVoiceLanguage` : FR / BM / MIXED / UNKNOWN, MIXED sur code-switching.
 *  - `effectiveTextOf` : correctedText prioritaire, original jamais écrasé.
 *  - `MockVoiceProvider` : déterministe, aucun appel réseau.
 *  - `VoiceTranscription @@unique([messageId])` : une transcription par message.
 *  - `dispatchVoiceJob` : `setImmediate` → le webhook ne l'attend pas.
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";

test(
  "intégration Djeli Voice (nécessite RUN_DB_TESTS + DB)",
  {
    skip: !RUN,
    todo: "À implémenter : transcribeMessage / correctTranscription / retranscribeMessage sur une base de test.",
  },
  () => {},
);
