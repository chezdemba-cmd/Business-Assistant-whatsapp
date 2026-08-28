/**
 * Règles PURES de paiement / créance — aucune dépendance Prisma ni Next.
 *
 * Principe (§4, §11) : la créance n'est JAMAIS un champ stocké.
 *   balanceDue = totalAmount − Σ(paiements CONFIRMED)
 * L'UI ne choisit jamais le statut de paiement : `derivePaymentStatus` fait foi.
 *
 * Montants : entiers, plus petite unité de la devise (mêmes règles que Order).
 */

import type { OrderPaymentStatus, OrderStatus, PaymentStatus } from "@prisma/client";

// ─────────────────────────── Somme & solde ───────────────────────────

export type PaymentLike = {
  amount: number;
  status: PaymentStatus;
};

/** Somme des paiements CONFIRMED uniquement (PENDING et CANCELLED ignorés). */
export function sumConfirmedPayments(payments: readonly PaymentLike[]): number {
  return payments.reduce(
    (sum, p) => (p.status === "CONFIRMED" ? sum + Math.trunc(p.amount) : sum),
    0,
  );
}

/** Solde restant dû. Ne descend jamais sous 0 (surpaiement interdit en amont). */
export function balanceDue(totalAmount: number, amountPaid: number): number {
  return Math.max(0, Math.trunc(totalAmount) - Math.trunc(amountPaid));
}

// ─────────────────────────── Statut dérivé ───────────────────────────

/**
 * Statut de paiement d'une commande, dérivé du total et du montant encaissé.
 *   amountPaid ≤ 0        → UNPAID, ou CREDIT si vente à crédit (creditMode)
 *   0 < amountPaid < total → PARTIALLY_PAID
 *   amountPaid ≥ total     → PAID
 *
 * `creditMode` : la commande a une échéance (vente à crédit assumée).
 */
export function derivePaymentStatus(
  totalAmount: number,
  amountPaid: number,
  opts: { creditMode?: boolean } = {},
): OrderPaymentStatus {
  const total = Math.trunc(totalAmount);
  const paid = Math.trunc(amountPaid);

  if (total > 0 && paid >= total) return "PAID";
  if (paid <= 0) return opts.creditMode ? "CREDIT" : "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIALLY_PAID";
}

// ─────────────────────────── Surpaiement ───────────────────────────

export class OverpaymentError extends Error {
  constructor(message = "Montant supérieur au solde restant.") {
    super(message);
    this.name = "OverpaymentError";
  }
}

/**
 * Vérifie qu'un encaissement supplémentaire ne dépasse pas le solde restant.
 * Lève `OverpaymentError` sinon (§8 : surpaiement interdit par défaut).
 */
export function assertWithinBalance(input: {
  totalAmount: number;
  amountPaidBefore: number;
  incomingAmount: number;
}): void {
  const incoming = Math.trunc(input.incomingAmount);
  if (incoming <= 0) {
    throw new OverpaymentError("Le montant du paiement doit être positif.");
  }
  const remaining = balanceDue(input.totalAmount, input.amountPaidBefore);
  if (incoming > remaining) {
    throw new OverpaymentError("Montant supérieur au solde restant.");
  }
}

// ─────────────────────────── Créance & retard ───────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Nombre de jours entiers de retard par rapport à l'échéance.
 * Négatif si l'échéance est dans le futur, 0 le jour même.
 */
export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - dueDate.getTime()) / DAY_MS);
}

/**
 * Une créance est officiellement recouvrable (§12) quand la commande est
 * LIVRÉE et qu'il reste un solde. Le retard (§13) exige en plus une échéance
 * dépassée. Échéance nulle → jamais « en retard » automatiquement.
 */
export function isOrderOverdue(
  input: { status: OrderStatus; balanceDue: number; dueDate: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    input.status === "DELIVERED" &&
    input.balanceDue > 0 &&
    input.dueDate != null &&
    input.dueDate.getTime() < now.getTime()
  );
}

/** Créance recouvrable : commande LIVRÉE + solde strictement positif (§12). */
export function isRecoverableDebt(input: {
  status: OrderStatus;
  balanceDue: number;
}): boolean {
  return input.status === "DELIVERED" && input.balanceDue > 0;
}

// ─────────────────────────── Tranches d'ancienneté ───────────────────────────

export type AgingBucket =
  | "NOT_DUE"
  | "D1_7"
  | "D8_30"
  | "D31_60"
  | "D61_90"
  | "D90_PLUS";

export const AGING_BUCKETS: readonly AgingBucket[] = [
  "NOT_DUE",
  "D1_7",
  "D8_30",
  "D31_60",
  "D61_90",
  "D90_PLUS",
];

export const AGING_BUCKET_LABEL: Record<AgingBucket, string> = {
  NOT_DUE: "À échoir",
  D1_7: "1–7 jours",
  D8_30: "8–30 jours",
  D31_60: "31–60 jours",
  D61_90: "61–90 jours",
  D90_PLUS: "90+ jours",
};

/**
 * Tranche d'ancienneté d'une créance à partir de son échéance.
 * `dueDate` null ou future → "NOT_DUE".
 */
export function agingBucketFor(
  dueDate: Date | null,
  now: Date = new Date(),
): AgingBucket {
  if (dueDate == null) return "NOT_DUE";
  const d = daysOverdue(dueDate, now);
  if (d <= 0) return "NOT_DUE";
  if (d <= 7) return "D1_7";
  if (d <= 30) return "D8_30";
  if (d <= 60) return "D31_60";
  if (d <= 90) return "D61_90";
  return "D90_PLUS";
}

// ─────────────────────────── Libellés ───────────────────────────

export const PAYMENT_METHOD_LABEL = {
  CASH: "Espèces",
  BANK_TRANSFER: "Virement bancaire",
  MOBILE_MONEY: "Mobile money",
  CHEQUE: "Chèque",
  CARD: "Carte",
  OTHER: "Autre",
} as const;

export const PAYMENT_PROVIDER_LABEL = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  MOOV: "Moov Money",
  OTHER: "Autre",
} as const;

export const PAYMENT_STATUS_LABEL = {
  CONFIRMED: "Confirmé",
  PENDING: "En attente",
  CANCELLED: "Annulé",
} as const;

export const PAYMENT_METHODS = Object.keys(
  PAYMENT_METHOD_LABEL,
) as (keyof typeof PAYMENT_METHOD_LABEL)[];

export const PAYMENT_PROVIDERS = Object.keys(
  PAYMENT_PROVIDER_LABEL,
) as (keyof typeof PAYMENT_PROVIDER_LABEL)[];
