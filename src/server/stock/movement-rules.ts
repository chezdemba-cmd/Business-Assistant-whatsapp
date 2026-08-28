import type { StockMovementType } from "@prisma/client";

/**
 * Règles de stock — fonctions PURES (aucune dépendance runtime, testables
 * sans base de données). Toute la logique « delta / état / marge » vit ici :
 * ne pas la dupliquer dans les pages ou les actions.
 *
 * Convention : `quantity` est TOUJOURS strictement positive. Le sens physique
 * (±) est déterminé par le `type` du mouvement.
 */

/** Mouvements qui AUGMENTENT le stock physique. */
export const INCOMING_TYPES = [
  "INITIAL",
  "PURCHASE",
  "ADJUSTMENT_IN",
  "RETURN_IN",
  "CANCELLATION",
] as const satisfies readonly StockMovementType[];

/** Mouvements qui DIMINUENT le stock physique. */
export const OUTGOING_TYPES = [
  "SALE",
  "ADJUSTMENT_OUT",
  "RETURN_OUT",
] as const satisfies readonly StockMovementType[];

export const MOVEMENT_TYPES = [
  ...INCOMING_TYPES,
  ...OUTGOING_TYPES,
] as const;

/** Types saisissables manuellement dans le formulaire de mouvement. */
export const MANUAL_MOVEMENT_TYPES = [
  "PURCHASE",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RETURN_IN",
  "RETURN_OUT",
] as const satisfies readonly StockMovementType[];

const INCOMING_SET = new Set<string>(INCOMING_TYPES);

export function isIncoming(type: StockMovementType): boolean {
  return INCOMING_SET.has(type);
}

export function movementSign(type: StockMovementType): 1 | -1 {
  return isIncoming(type) ? 1 : -1;
}

/** Delta physique signé d'un mouvement (quantity attendue > 0). */
export function movementPhysicalDelta(
  type: StockMovementType,
  quantity: number,
): number {
  return movementSign(type) * Math.abs(Math.trunc(quantity));
}

/** Somme des deltas physiques d'une liste de mouvements. */
export function computePhysicalStock(
  movements: ReadonlyArray<{ type: StockMovementType; quantity: number }>,
): number {
  return movements.reduce(
    (sum, m) => sum + movementPhysicalDelta(m.type, m.quantity),
    0,
  );
}

/** Stock disponible = physique − réservé (peut être < 0 en cas d'anomalie). */
export function availableStock(physical: number, reserved: number): number {
  return physical - reserved;
}

export type StockState = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export function stockState(
  available: number,
  alertThreshold: number,
): StockState {
  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= alertThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

export const STOCK_STATE_LABEL: Record<StockState, string> = {
  IN_STOCK: "En stock",
  LOW_STOCK: "Stock faible",
  OUT_OF_STOCK: "Rupture",
};

export const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  INITIAL: "Stock initial",
  PURCHASE: "Achat",
  SALE: "Vente",
  ADJUSTMENT_IN: "Ajustement +",
  ADJUSTMENT_OUT: "Ajustement −",
  RETURN_IN: "Retour client",
  RETURN_OUT: "Retour fournisseur",
  CANCELLATION: "Annulation commande",
};

/**
 * Marge. Gère `salePrice = 0` sans division par zéro. Renvoie `null` si le
 * prix d'achat est inconnu.
 */
export function marginOf(
  salePrice: number,
  purchasePrice: number | null | undefined,
): { amount: number; percent: number | null } | null {
  if (purchasePrice == null) return null;
  const amount = salePrice - purchasePrice;
  const percent = salePrice > 0 ? (amount / salePrice) * 100 : null;
  return { amount, percent };
}

/**
 * Ajustement d'inventaire : à partir du stock système et du stock compté,
 * renvoie le mouvement à créer (type + quantité positive), ou `null` si égal.
 * Le CLIENT ne décide jamais du delta en mode inventaire — c'est calculé ici.
 */
export function inventoryAdjustment(
  previousPhysical: number,
  countedStock: number,
): { type: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT"; quantity: number } | null {
  const diff = Math.trunc(countedStock) - Math.trunc(previousPhysical);
  if (diff === 0) return null;
  return diff > 0
    ? { type: "ADJUSTMENT_IN", quantity: diff }
    : { type: "ADJUSTMENT_OUT", quantity: -diff };
}

/**
 * Type compensatoire pour ANNULER un mouvement existant (reversal explicite,
 * jamais d'édition/suppression du mouvement d'origine).
 */
export function reversalTypeFor(
  type: StockMovementType,
): "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" {
  return movementSign(type) === 1 ? "ADJUSTMENT_OUT" : "ADJUSTMENT_IN";
}

/** Valeur estimée du stock au prix d'achat courant (pas de FIFO/CUMP). */
export function stockValueAtPurchasePrice(
  physical: number,
  purchasePrice: number | null | undefined,
): number {
  if (purchasePrice == null) return 0;
  return Math.max(0, physical) * purchasePrice;
}
