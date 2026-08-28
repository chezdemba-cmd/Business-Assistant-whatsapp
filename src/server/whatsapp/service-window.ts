/**
 * Fenêtre de service client WhatsApp — 24 h à partir du dernier message
 * ENTRANT du client (règle Meta). Hors fenêtre : seul un modèle (template)
 * approuvé peut être envoyé — le texte libre est bloqué (Phase 5).
 */

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isCustomerServiceWindowOpen(
  lastInboundAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < SERVICE_WINDOW_MS;
}

/** Millisecondes restantes avant fermeture (0 si déjà fermée). */
export function serviceWindowRemainingMs(
  lastInboundAt: Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!lastInboundAt) return 0;
  return Math.max(
    0,
    SERVICE_WINDOW_MS - (now.getTime() - lastInboundAt.getTime()),
  );
}
