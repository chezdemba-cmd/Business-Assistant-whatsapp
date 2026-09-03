/**
 * Allowlist de navigation pour le shell natif / WebView Capacitor — PUR
 * (§82, §83). La WebView ne doit charger QUE l'app Djeli ; toute autre URL
 * s'ouvre dans le navigateur système (ou est bloquée).
 *
 * Autorisé DANS la WebView :
 *   - même origine que l'app (STAGING_API_URL / PRODUCTION_API_URL)
 *   - `about:blank`
 * Ouvert HORS WebView (navigateur système), jamais dans la WebView :
 *   - `tel:` `mailto:` `sms:` `geo:`
 *   - `https://wa.me/*` `https://api.whatsapp.com/*`
 *   - `https://www.google.com/maps*` `https://maps.google.com/*` `https://maps.apple.com/*`
 * Tout le reste : bloqué.
 */

export type NavDecision = "webview" | "system-browser" | "block";

const SYSTEM_SCHEMES = ["tel:", "mailto:", "sms:", "geo:"];

// Hôtes https toujours ouverts dans le navigateur système (quel que soit le chemin).
const SYSTEM_HTTPS_HOSTS = [
  "wa.me",
  "api.whatsapp.com",
  "maps.google.com",
  "maps.apple.com",
];

// Hôtes autorisés UNIQUEMENT sur le chemin /maps.
const MAPS_PATH_HOSTS = ["www.google.com", "google.com"];

export function classifyNavigation(
  target: string,
  opts: { appOrigins: string[] },
): NavDecision {
  const t = (target ?? "").trim();
  if (!t) return "block";
  if (t === "about:blank") return "webview";

  const lower = t.toLowerCase();
  if (SYSTEM_SCHEMES.some((s) => lower.startsWith(s))) return "system-browser";

  let url: URL;
  try {
    url = new URL(t);
  } catch {
    return "block";
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return url.protocol === "capacitor:" || url.protocol === "ionic:"
      ? "webview"
      : "block";
  }

  const origin = `${url.protocol}//${url.host}`;
  if (opts.appOrigins.map((o) => o.toLowerCase()).includes(origin.toLowerCase())) {
    return "webview";
  }

  if (url.protocol === "https:") {
    const host = url.host.toLowerCase();
    if (SYSTEM_HTTPS_HOSTS.includes(host)) return "system-browser";
    if (MAPS_PATH_HOSTS.includes(host)) {
      return url.pathname.startsWith("/maps") ? "system-browser" : "block";
    }
  }

  return "block";
}

export function isWebViewAllowed(target: string, appOrigins: string[]): boolean {
  return classifyNavigation(target, { appOrigins }) === "webview";
}
