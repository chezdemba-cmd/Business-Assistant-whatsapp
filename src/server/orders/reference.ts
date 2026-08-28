/** Référence lisible d'une commande à partir de son numéro séquentiel — PUR. */
export function formatOrderReference(orderNumber: number): string {
  return `CMD-${String(Math.trunc(orderNumber)).padStart(4, "0")}`;
}
