/**
 * Normalisation du SKU — fonction PURE. Unicité assurée par la contrainte DB
 * `@@unique([organizationId, sku])`.
 *
 *   "  suc-050 "  -> "SUC-050"
 *   "suc 050"      -> "SUC-050"
 *   "Riz//25"      -> "RIZ-25"
 */
export function normalizeSku(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s/\\_]+/g, "-")
    .replace(/[^A-Z0-9.\-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

export function isValidSku(sku: string): boolean {
  return /^[A-Z0-9][A-Z0-9.\-]{0,47}$/.test(sku);
}
