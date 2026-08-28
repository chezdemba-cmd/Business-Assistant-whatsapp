import { test } from "node:test";

/**
 * Tests d'INTÉGRATION paiements / créances / relances.
 * Nécessitent une vraie base PostgreSQL :
 *   RUN_DB_TESTS=1 DATABASE_URL=postgres://… npm test
 *
 * Scénarios attendus (§37–§45) une fois branchés :
 *
 *  §37 Paiement partiel — commande LIVRÉE total 189000 :
 *      recordPayment(100000) → Order.amountPaid=100000, paymentStatus=PARTIALLY_PAID,
 *      balanceDue=89000 ; puis recordPayment(89000) → amountPaid=189000, PAID, balance=0.
 *
 *  §38 Surpaiement — solde restant 89000, recordPayment(90000) :
 *      refus « Montant supérieur au solde restant. », AUCUNE ligne Payment créée,
 *      Order inchangé.
 *
 *  §39 Annulation — 189000, recordPayment(100000) puis cancelPayment :
 *      Payment.status=CANCELLED (jamais supprimé) + cancelledAt/cancelledByUserId ;
 *      Order.amountPaid re-calculé à 0, paymentStatus re-dérivé (PARTIALLY_PAID→UNPAID),
 *      AuditLog PAYMENT_CANCELLED présent.
 *
 *  §40 Créance — Order DELIVERED total 189000, payé 100000, dueDate = hier :
 *      getOrderPaymentSummary → balanceDue 89000, isOverdue true ;
 *      getCustomerFinancialSummary → totalOutstanding 89000, overdueOutstanding 89000.
 *
 *  §41 Non-créance — Order NON DELIVERED avec solde : n'apparaît pas dans listDebts,
 *      isOverdue false, exclu de getOverdueDebtsSummary.
 *
 *  §42 Concurrence — solde 100000, deux recordPayment(80000) simultanés :
 *      un seul réussit, l'autre est refusé (surpaiement) ;
 *      Order.amountPaid final = 80000, JAMAIS 160000.
 *      Garantie : payment-service verrouille la ligne `orders`
 *      (`SELECT id FROM "orders" WHERE id = $1 FOR UPDATE`) AVANT de resommer les
 *      paiements CONFIRMED et de contrôler le dépassement, dans la même
 *      transaction. La 2ᵉ transaction attend la fin de la 1ʳᵉ puis relit un
 *      montant déjà payé à jour.
 *
 *  §43 Multi-tenant — org A ne peut ni voir, ni encaisser, ni annuler un paiement
 *      d'org B ; ne voit pas les campagnes de relance d'org B. Tout ID forgé échoue
 *      (NotFound), aucune fuite.
 *
 *  §44 Périmètre SALES — recordPayment sur commande d'un client ASSIGNÉ au SALES :
 *      autorisé ; sur un client NON assigné : refusé (Forbidden), aucune écriture.
 *
 *  §45 Relances — createReminderCampaign sur 3 créances :
 *      3 ReminderCampaignItem, amountDue snapshotés au solde courant, message
 *      généré (prénom + réf + solde + échéance), chaque item lié au bon
 *      customerId/orderId ; campagne DRAFT. sendReminderCampaign (simulation) :
 *      items PENDING→SENT + sentAt, campagne SENT + sentAt, CustomerActivity
 *      REMINDER_SENT, AuditLog REMINDER_SENT (metadata.simulated = true).
 *      AUCUN message réellement transmis.
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";

test("intégration paiements/créances/relances (nécessite RUN_DB_TESTS + DB)", { skip: !RUN }, () => {
  throw new Error(
    "Brancher ici les scénarios recordPayment / cancelPayment / listDebts / reminders sur une base de test.",
  );
});
