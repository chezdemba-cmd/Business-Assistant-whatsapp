import { test } from "node:test";

/**
 * Tests d'INTÉGRATION WhatsApp / conversations. Nécessitent PostgreSQL :
 *   RUN_DB_TESTS=1 DATABASE_URL=postgres://… npm test
 *
 * Scénarios attendus (§50–§56) une fois branchés :
 *
 *  §50 Webhook inbound, client absent —
 *      POST signé, phone_number_id → WhatsAppConnection → Org A. wa_id inconnu.
 *      Résultat : Customer (source=WHATSAPP, status=ACTIVE) créé + CustomerActivity
 *      CUSTOMER_CREATED (metadata.source=WHATSAPP) ; Conversation créée
 *      (mode HUMAN, status OPEN) ; Message INBOUND (status RECEIVED, type TEXT) ;
 *      conversation.unreadCount = 1, lastInboundAt renseigné.
 *      2ᵉ livraison du MÊME externalMessageId → aucun doublon (Message,
 *      Customer, Conversation, CustomerActivity inchangés).
 *
 *  §51 Client existant — Customer avec ce téléphone (E.164) existe déjà :
 *      réutilisé, aucun doublon, Conversation liée au bon Customer.
 *
 *  §52 Multi-tenant — Org A (PNID_A), Org B (PNID_B). Webhook reçu sur PNID_A
 *      ne crée jamais de Customer / Conversation / Message rattaché à Org B.
 *      Un phone_number_id inconnu → événement ignoré, 200, rien créé.
 *
 *  §53 Outbound — utilisateur autorisé envoie « Bonjour Aminata » ; provider
 *      mock renvoie un messageId. Message OUTBOUND status SENT, externalMessageId
 *      stocké, conversation.lastOutboundAt mis à jour ; si la conversation était
 *      en AUTO → passe en HUMAN + AuditLog CONVERSATION_MODE_CHANGED ;
 *      CustomerActivity MESSAGE_SENT ; AuditLog MESSAGE_SENT.
 *
 *  §54 Envoi en échec — provider mock configuré pour renvoyer une erreur :
 *      Message OUTBOUND status FAILED (errorCode/errorMessage), PAS de faux SENT ;
 *      l'action retourne une erreur utilisateur propre.
 *
 *  §55 Webhook de statut — SENT → DELIVERED → READ appliqués dans l'ordre ;
 *      un webhook « sent » en retard reçu APRÈS « read » ne régresse pas (reste READ).
 *
 *  §56 Périmètre SALES — SALES assigné à la conversation (ou à son client) :
 *      lecture + envoi autorisés. SALES ni assigné ni propriétaire du client :
 *      refus (Forbidden), aucune écriture.
 *
 * Garanties sans DB ici :
 *  - Idempotence : unique `(organizationId, externalMessageId)` sur `messages` ;
 *    `ingestInboundMessage` vérifie d'abord l'existence, puis retombe sur P2002.
 *  - Tenant : `processWhatsAppWebhook` résout la connexion par `phoneNumberId`
 *    (jamais par le numéro client) puis n'écrit que sous `connection.organizationId`.
 *  - Fenêtre 24 h : `sendConversationMessage` refuse si
 *    `isCustomerServiceWindowOpen(conversation.lastInboundAt)` est faux.
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";

test("intégration WhatsApp/conversations (nécessite RUN_DB_TESTS + DB)", { skip: !RUN }, () => {
  throw new Error(
    "Brancher ici processWhatsAppWebhook / sendConversationMessage / applyStatusUpdate sur une base de test.",
  );
});
