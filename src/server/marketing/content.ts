import type { MarketingCampaignType } from "@prisma/client";

/**
 * Génération de contenu marketing — PUR (§18, §48). Djeli IA peut reformuler,
 * mais jamais publier : le texte reste un APERÇU à valider. Placeholder unique
 * `{{name}}` remplacé par le nom du client à l'envoi.
 */

export const MESSAGE_MAX_LEN = 900;

const DEFAULT_TEMPLATES: Record<MarketingCampaignType, (org: string) => string> = {
  CUSTOMER_REACTIVATION: (org) =>
    `Bonjour {{name}}, cela fait un moment ! ${org} a de nouveau de belles offres pour vous. Passez nous voir ou répondez à ce message pour votre prochaine commande.`,
  PROMOTION: (org) =>
    `Bonjour {{name}}, ${org} lance une promotion cette semaine. Répondez à ce message pour connaître les prix et réserver vos articles.`,
  NEW_PRODUCT: (org) =>
    `Bonjour {{name}}, ${org} vient de recevoir un nouveau produit susceptible de vous intéresser. Dites-nous si vous voulez en savoir plus.`,
  LOW_ACTIVITY: (org) =>
    `Bonjour {{name}}, on ne vous a pas vu depuis quelque temps chez ${org}. Un besoin à préparer pour vous ?`,
  CUSTOM: () => `Bonjour {{name}}, `,
};

export function defaultCampaignMessage(
  type: MarketingCampaignType,
  organizationName: string,
): string {
  return DEFAULT_TEMPLATES[type](organizationName).slice(0, MESSAGE_MAX_LEN);
}

/** Substitue `{{name}}` (et variantes espacées) par le nom du client. */
export function renderCampaignMessage(template: string, customerName: string): string {
  const name = customerName.trim() || "cher client";
  return template.replace(/\{\{\s*name\s*\}\}/gi, name).slice(0, MESSAGE_MAX_LEN);
}

export function validateCampaignMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length < 10) {
    throw new Error("Le message de campagne est trop court.");
  }
  if (trimmed.length > MESSAGE_MAX_LEN) {
    throw new Error(`Le message dépasse ${MESSAGE_MAX_LEN} caractères.`);
  }
  return trimmed;
}
