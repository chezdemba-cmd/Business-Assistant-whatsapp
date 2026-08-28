import type { OrderStatus } from "@prisma/client";

/**
 * Machine de transition des commandes — PURE (testable sans DB).
 * Toute la logique « quel statut peut aller vers quel statut » vit ici :
 * jamais dispersée dans les boutons.
 */

export const ORDER_STATUSES = [
  "NEW",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
] as const satisfies readonly OrderStatus[];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Nouvelle",
  PENDING_CONFIRMATION: "À confirmer",
  CONFIRMED: "Confirmée",
  PREPARING: "En préparation",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REJECTED: "Refusée",
};

/** États « ouverts » qui immobilisent du stock réservé. */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
  "NEW",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
];

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
];

/** Transitions autorisées : from -> [to...]. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED", "REJECTED"],
  PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED", "REJECTED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

/** Une commande peut-elle encore être annulée / refusée ? */
export function isCancellable(status: OrderStatus): boolean {
  return (
    canTransitionOrderStatus(status, "CANCELLED") ||
    canTransitionOrderStatus(status, "REJECTED")
  );
}

/** Les lignes de la commande sont-elles encore modifiables ? */
export function areItemsEditable(status: OrderStatus): boolean {
  return status === "NEW" || status === "PENDING_CONFIRMATION";
}

/** Cette transition libère-t-elle les réservations ACTIVE ? */
export function releasesReservations(to: OrderStatus): boolean {
  return to === "CANCELLED" || to === "REJECTED";
}

/** Cette transition solde-t-elle les réservations (mouvement SALE) ? */
export function fulfillsReservations(to: OrderStatus): boolean {
  return to === "DELIVERED";
}
