/**
 * Deep links Djeli — PUR (§40, §41). Schéma `djeli://` pour ouvrir directement
 * une entité depuis une notification ou un lien externe.
 *
 *   djeli://order/123     → /orders/123
 *   djeli://customer/123  → /customers/123
 *   djeli://chat/123      → /conversations/123
 *   djeli://product/123   → /catalog/123
 *   djeli://recommendations
 *   djeli://home | djeli://dashboard
 *
 * Toute cible inconnue → null (jamais de navigation arbitraire).
 */

export const DEEP_LINK_SCHEME = "djeli";

type Entity = { kind: string; segment: string; withId: boolean };

const ENTITIES: Entity[] = [
  { kind: "order", segment: "orders", withId: true },
  { kind: "customer", segment: "customers", withId: true },
  { kind: "chat", segment: "conversations", withId: true },
  { kind: "conversation", segment: "conversations", withId: true },
  { kind: "product", segment: "catalog", withId: true },
  { kind: "debt", segment: "debts", withId: false },
  { kind: "debts", segment: "debts", withId: false },
  { kind: "recommendation", segment: "recommendations", withId: false },
  { kind: "recommendations", segment: "recommendations", withId: false },
  { kind: "notifications", segment: "notifications", withId: false },
  { kind: "ai", segment: "ai", withId: false },
  { kind: "djeli", segment: "ai", withId: false },
  { kind: "home", segment: "dashboard", withId: false },
  { kind: "dashboard", segment: "dashboard", withId: false },
];

export type ParsedDeepLink = {
  kind: string;
  id: string | null;
  /** Chemin applicatif interne sûr (toujours relatif, commence par « / »). */
  path: string;
};

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Parse un deep link (`djeli://…`) ou un chemin `djeli/…`. Retourne null si invalide. */
export function parseDeepLink(input: string): ParsedDeepLink | null {
  if (typeof input !== "string" || !input.trim()) return null;
  let rest = input.trim();

  const lower = rest.toLowerCase();
  if (lower.startsWith(`${DEEP_LINK_SCHEME}://`)) {
    rest = rest.slice(`${DEEP_LINK_SCHEME}://`.length);
  } else if (lower.startsWith(`${DEEP_LINK_SCHEME}:`)) {
    rest = rest.slice(`${DEEP_LINK_SCHEME}:`.length).replace(/^\/+/, "");
  } else {
    return null;
  }

  // Retire query/hash et les slashes de bord.
  rest = rest.split(/[?#]/)[0]!.replace(/^\/+|\/+$/g, "");
  if (!rest) return null;

  const parts = rest.split("/").filter(Boolean);
  const kindRaw = (parts[0] ?? "").toLowerCase();
  const entity = ENTITIES.find((e) => e.kind === kindRaw);
  if (!entity) return null;

  if (entity.withId) {
    const id = parts[1] ?? "";
    if (!ID_RE.test(id)) return null;
    return { kind: entity.kind, id, path: `/${entity.segment}/${id}` };
  }
  return { kind: entity.kind, id: null, path: `/${entity.segment}` };
}

/** Construit un deep link à partir d'un kind + id (pour les notifications). */
export function toDeepLink(kind: string, id?: string | null): string | null {
  const entity = ENTITIES.find((e) => e.kind === kind);
  if (!entity) return null;
  if (entity.withId) {
    if (!id || !ID_RE.test(id)) return null;
    return `${DEEP_LINK_SCHEME}://${kind}/${id}`;
  }
  return `${DEEP_LINK_SCHEME}://${kind}`;
}

/** Chemin interne sûr pour une entité (utilisé par le handler de notification). */
export function deepLinkPath(kind: string, id?: string | null): string | null {
  const dl = toDeepLink(kind, id);
  return dl ? (parseDeepLink(dl)?.path ?? null) : null;
}
