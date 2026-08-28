/**
 * Consentement marketing — PUR (§28, §29, §67).
 *
 * Un client désinscrit (`marketingOptIn = false` ou `marketingOptOutAt` posé)
 * ne reçoit JAMAIS de campagne marketing. Les communications TRANSACTIONNELLES
 * (relance de créance, confirmation de commande) suivent leur propre logique et
 * ne sont pas concernées par ce module.
 */

export type ConsentShape = {
  marketingOptIn: boolean;
  marketingOptOutAt: Date | null;
  status?: string; // CustomerStatus — un client archivé est exclu aussi
  phone?: string | null;
};

/** Le client peut-il recevoir une campagne marketing WhatsApp ? */
export function canReceiveMarketing(c: ConsentShape): boolean {
  if (c.marketingOptOutAt) return false;
  if (!c.marketingOptIn) return false;
  if (c.status && c.status !== "ACTIVE") return false;
  return true;
}

/** Le client peut-il être contacté sur le canal WhatsApp (numéro présent) ? */
export function isReachableOnWhatsApp(c: ConsentShape): boolean {
  return typeof c.phone === "string" && c.phone.trim().length > 0;
}

export type AudienceSplit<T extends ConsentShape> = {
  included: T[];
  excludedOptOut: T[];
  excludedUnreachable: T[];
};

/**
 * Sépare une liste de clients en inclus / exclus (opt-out) / exclus
 * (injoignables) pour l'aperçu d'audience (§27). L'ordre d'entrée est conservé.
 */
export function splitAudienceByConsent<T extends ConsentShape>(
  customers: T[],
): AudienceSplit<T> {
  const out: AudienceSplit<T> = {
    included: [],
    excludedOptOut: [],
    excludedUnreachable: [],
  };
  for (const c of customers) {
    if (!canReceiveMarketing(c)) out.excludedOptOut.push(c);
    else if (!isReachableOnWhatsApp(c)) out.excludedUnreachable.push(c);
    else out.included.push(c);
  }
  return out;
}
