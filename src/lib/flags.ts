/**
 * Feature flags mobile — PUR (§84). Lus depuis l'environnement (build-time pour
 * les `NEXT_PUBLIC_*`, sinon runtime serveur). Défauts sûrs : PWA activée,
 * natif et push désactivés tant qu'ils ne sont pas déployés.
 */

export type MobileFlags = {
  PWA: boolean;
  MOBILE_NATIVE: boolean;
  PUSH_NOTIFICATIONS: boolean;
};

function truthy(v: string | undefined | null): boolean {
  if (v == null) return false;
  return ["1", "true", "on", "yes"].includes(v.trim().toLowerCase());
}

export function resolveMobileFlags(
  env: Record<string, string | undefined> = {},
): MobileFlags {
  return {
    PWA: env.NEXT_PUBLIC_PWA_ENABLED == null ? true : truthy(env.NEXT_PUBLIC_PWA_ENABLED),
    MOBILE_NATIVE: truthy(env.NEXT_PUBLIC_MOBILE_NATIVE),
    PUSH_NOTIFICATIONS: truthy(env.NEXT_PUBLIC_PUSH_NOTIFICATIONS),
  };
}

/** Accès direct côté client (les NEXT_PUBLIC_* sont inlinés au build). */
export const mobileFlags: MobileFlags = resolveMobileFlags({
  NEXT_PUBLIC_PWA_ENABLED: process.env.NEXT_PUBLIC_PWA_ENABLED,
  NEXT_PUBLIC_MOBILE_NATIVE: process.env.NEXT_PUBLIC_MOBILE_NATIVE,
  NEXT_PUBLIC_PUSH_NOTIFICATIONS: process.env.NEXT_PUBLIC_PUSH_NOTIFICATIONS,
});
