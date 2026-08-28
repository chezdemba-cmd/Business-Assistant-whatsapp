import "server-only";
import { prisma } from "@/server/db/client";

/**
 * Suivi d'onboarding pilote (§41). Étapes concrètes pour amener une
 * organisation à l'« activation » (§46).
 */
export type OnboardingStep = {
  key: string;
  label: string;
  done: boolean;
  href: string;
};

export type OnboardingProgress = {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  activated: boolean;
};

export async function getOnboardingProgress(
  organizationId: string,
): Promise<OnboardingProgress> {
  const [products, movements, customers, orders, aiRuns, whatsapp] = await Promise.all([
    prisma.product.count({ where: { organizationId } }),
    prisma.stockMovement.count({ where: { organizationId } }),
    prisma.customer.count({ where: { organizationId } }),
    prisma.order.count({ where: { organizationId } }),
    prisma.aiRun.count({ where: { organizationId } }),
    prisma.whatsAppConnection.count({ where: { organizationId, status: "CONNECTED" } }),
  ]);

  const steps: OnboardingStep[] = [
    { key: "account", label: "Compte créé", done: true, href: "/profile" },
    { key: "org", label: "Entreprise configurée", done: true, href: "/settings" },
    { key: "catalog", label: "Ajouter des produits", done: products > 0, href: "/catalog/new" },
    { key: "stock", label: "Initialiser le stock", done: movements > 0, href: "/stock/new" },
    { key: "whatsapp", label: "Connecter WhatsApp Business", done: whatsapp > 0, href: "/settings" },
    { key: "customer", label: "Ajouter un premier client", done: customers > 0, href: "/customers/new" },
    { key: "order", label: "Créer une première commande", done: orders > 0, href: "/orders/new" },
    { key: "ai", label: "Essayer Djeli IA", done: aiRuns > 0, href: "/ai" },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    activated: products > 0 && customers > 0 && orders > 0 && whatsapp > 0 && aiRuns > 0,
  };
}
