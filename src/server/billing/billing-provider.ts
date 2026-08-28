import "server-only";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Abstraction de facturation (§18). Djeli doit pouvoir brancher plus tard
 * Stripe, PayDunya, CinetPay, Orange Money, Wave, ou rester en facturation
 * MANUELLE. Pour le pilote : `ManualBillingProvider` (aucune intégration de
 * paiement — le suivi se fait hors application).
 */

export type CheckoutRequest = {
  organizationId: string;
  planCode: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = {
  provider: string;
  /** URL de paiement, ou null si le provider est manuel. */
  url: string | null;
  reference: string;
};

export type BillingEvent = {
  type: "checkout.completed" | "subscription.updated" | "payment.failed";
  organizationId: string;
  raw: unknown;
};

export interface BillingProvider {
  readonly name: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Traite un webhook fournisseur (déjà vérifié). Pas d'effet en manuel. */
  handleWebhook(payload: unknown, signature: string | null): Promise<BillingEvent | null>;
}

class ManualBillingProvider implements BillingProvider {
  readonly name = "manual";

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    logger.info("billing.manual.checkout", {
      service: "billing",
      organizationId: req.organizationId,
      event: "manual_checkout_requested",
      planCode: req.planCode,
    });
    return { provider: "manual", url: null, reference: `manual-${req.organizationId}-${req.planCode}` };
  }

  async handleWebhook(): Promise<BillingEvent | null> {
    return null;
  }
}

let cached: BillingProvider | null = null;

export function getBillingProvider(): BillingProvider {
  if (cached) return cached;
  // "stripe" et autres providers : à brancher ici en fournissant une autre
  // implémentation de `BillingProvider`. `BILLING_PROVIDER=manual` par défaut.
  const kind = getEnv().BILLING_PROVIDER;
  if (kind !== "manual") {
    logger.warn("billing.provider.notImplemented", {
      service: "billing",
      event: "fallback_to_manual",
      requested: kind,
    });
  }
  cached = new ManualBillingProvider();
  return cached;
}
