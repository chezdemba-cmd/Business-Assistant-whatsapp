import { test } from "node:test";

/**
 * Tests d'INTÉGRATION commandes / réservations / concurrence.
 * Nécessitent une vraie base PostgreSQL : n'exécuter qu'avec
 *   RUN_DB_TESTS=1 DATABASE_URL=postgres://… npm test
 *
 * Scénarios attendus (§49–§52) une fois branchés :
 *  - création : physical inchangé, reservation ACTIVE = qty, available -= qty
 *  - annulation : reservation RELEASED, available restauré, aucun StockMovement
 *  - livraison : StockMovement SALE = qty, reservation FULFILLED, physical -= qty
 *  - stock insuffisant : refus total, aucune commande ni réservation partielle
 *  - concurrence : 2× reserveStockTx(6) sur available=6 → 1 succès, 1 échec,
 *    reserved final = 6 (jamais 12)
 *  - prix : unitPrice du navigateur ignoré, Product.salePrice fait foi
 *
 * Garantie concurrence sans DB ici : `order-service` verrouille les lignes
 * `products` via `SELECT … FOR UPDATE` (ordre trié) AVANT le contrôle de
 * disponibilité et la création de réservation, dans la même transaction.
 * Deux créations concurrentes pour le même produit sont donc sérialisées par
 * PostgreSQL : la seconde attend la fin de la première puis relit un
 * `available` à jour et échoue si le stock ne suffit plus.
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";

test("intégration commandes/stock (nécessite RUN_DB_TESTS + DB)", { skip: !RUN }, () => {
  throw new Error(
    "Brancher ici les scénarios createOrder / transitionOrder / concurrence sur une base de test.",
  );
});
