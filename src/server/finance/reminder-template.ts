/**
 * Moteur de gabarit de relance — PUR. Génère un message d'exemple à partir
 * du prénom, de la référence de commande, du solde et de l'échéance.
 *
 * Aucune intégration WhatsApp : le message produit ici est un brouillon
 * affiché à l'utilisateur, jamais transmis automatiquement (§24, §27).
 */

export type ReminderContext = {
  customerName: string;
  organizationName: string;
  orderReference?: string | null;
  balanceDue: number;
  currency: string;
  dueDate?: Date | null;
};

function formatMoney(amount: number, currency: string): string {
  const label =
    currency === "XOF" || currency === "XAF" ? "FCFA" : currency;
  const grouped = String(Math.trunc(amount)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    " ",
  );
  return `${grouped} ${label}`;
}

function formatDay(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Premier prénom exploitable, sinon le nom affiché tel quel. */
function firstName(name: string): string {
  const trimmed = name.trim();
  const first = trimmed.split(/\s+/)[0];
  return first && first.length > 1 ? first : trimmed;
}

/**
 * Message de relance par défaut (français, ton commerçant courtois).
 * Déterministe : mêmes entrées → même sortie (testable).
 */
export function buildReminderMessage(ctx: ReminderContext): string {
  const prenom = firstName(ctx.customerName);
  const montant = formatMoney(ctx.balanceDue, ctx.currency);
  const ref = ctx.orderReference ? ` (commande ${ctx.orderReference})` : "";
  const echeance = ctx.dueDate
    ? ` L'échéance était fixée au ${formatDay(ctx.dueDate)}.`
    : "";

  return (
    `Bonjour ${prenom}, ` +
    `il reste un solde de ${montant} à régler${ref}.` +
    echeance +
    ` Merci de votre confiance. — ${ctx.organizationName}`
  );
}
