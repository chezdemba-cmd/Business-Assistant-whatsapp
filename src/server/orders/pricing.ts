/**
 * Calcul des totaux de commande — PUR. Montants entiers (§6).
 *   total = subtotal - discountAmount + deliveryFee
 * Contrainte : 0 <= discountAmount <= subtotal.
 */

export type OrderLineInput = {
  unitPrice: number;
  quantity: number;
};

export type OrderTotals = {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
};

export class OrderPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderPricingError";
  }
}

export function lineSubtotal(line: OrderLineInput): number {
  return Math.trunc(line.unitPrice) * Math.trunc(line.quantity);
}

export function computeOrderTotals(input: {
  lines: OrderLineInput[];
  discountAmount?: number;
  deliveryFee?: number;
}): OrderTotals {
  if (input.lines.length === 0) {
    throw new OrderPricingError("Une commande doit contenir au moins un article.");
  }

  const subtotal = input.lines.reduce((sum, l) => {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
      throw new OrderPricingError("Quantité de ligne invalide.");
    }
    if (!Number.isInteger(l.unitPrice) || l.unitPrice < 0) {
      throw new OrderPricingError("Prix unitaire invalide.");
    }
    return sum + lineSubtotal(l);
  }, 0);

  const discountAmount = Math.trunc(input.discountAmount ?? 0);
  const deliveryFee = Math.trunc(input.deliveryFee ?? 0);

  if (discountAmount < 0) {
    throw new OrderPricingError("La remise ne peut pas être négative.");
  }
  if (discountAmount > subtotal) {
    throw new OrderPricingError(
      "La remise ne peut pas dépasser le sous-total.",
    );
  }
  if (deliveryFee < 0) {
    throw new OrderPricingError("Les frais de livraison ne peuvent pas être négatifs.");
  }

  return {
    subtotal,
    discountAmount,
    deliveryFee,
    totalAmount: subtotal - discountAmount + deliveryFee,
  };
}
