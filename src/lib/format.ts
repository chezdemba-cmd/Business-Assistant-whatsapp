/** Formatage — sûr côté client et serveur. */

const GROUP_SEP = " "; // séparateur de milliers

/** 31500 -> "31 500" */
export function formatInt(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = Math.abs(Math.trunc(n)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEP);
}

/** 31500, "XOF" -> "31 500 FCFA" (XOF/XAF affichés « FCFA »). */
export function formatAmount(
  n: number | null | undefined,
  currency: string,
): string {
  if (n == null) return "—";
  const symbol =
    currency === "XOF" || currency === "XAF" ? "FCFA" : currency.toUpperCase();
  return `${formatInt(n)} ${symbol}`;
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n == null) return "—";
  return `${n.toFixed(digits).replace(".", ",")} %`;
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
