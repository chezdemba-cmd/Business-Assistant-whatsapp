/**
 * Verrouillage de compte après échecs de connexion répétés — fonctions PURES
 * (aucune dépendance runtime, testables sans base de données).
 *
 * Complète le rate-limit par IP (mémoire, par instance) par une protection
 * PAR COMPTE stockée en base : efficace même en déploiement multi-instance et
 * insensible à l'usurpation de `X-Forwarded-For`.
 *
 * Le message d'erreur présenté à l'utilisateur ne doit pas révéler si le mot de
 * passe était correct — voir `loginAction`.
 */

/** Nombre d'échecs consécutifs déclenchant le verrouillage. */
export const LOGIN_LOCK_THRESHOLD = 10;

/** Durée du verrouillage, en millisecondes. */
export const LOGIN_LOCK_MS = 15 * 60_000;

export type LockoutState = {
  /** Échecs consécutifs depuis le dernier succès / la dernière expiration. */
  failedLoginCount: number;
  /** Instant jusqu'auquel toute tentative est refusée, ou null. */
  lockedUntil: Date | null;
};

/** Le compte est-il actuellement verrouillé ? */
export function isAccountLocked(
  state: Pick<LockoutState, "lockedUntil">,
  now: number = Date.now(),
): boolean {
  return state.lockedUntil != null && state.lockedUntil.getTime() > now;
}

/** Millisecondes restantes avant déverrouillage (0 si non verrouillé). */
export function lockRemainingMs(
  state: Pick<LockoutState, "lockedUntil">,
  now: number = Date.now(),
): number {
  if (!state.lockedUntil) return 0;
  return Math.max(0, state.lockedUntil.getTime() - now);
}

/**
 * Nouvel état après un échec d'authentification. Au `LOGIN_LOCK_THRESHOLD`ᵉ
 * échec consécutif, on pose `lockedUntil` et on remet le compteur à zéro
 * (le prochain cycle recommencera après expiration).
 */
export function registerFailedAttempt(
  state: LockoutState,
  now: number = Date.now(),
): LockoutState & { justLocked: boolean } {
  // Un verrouillage encore actif n'est jamais prolongé par de nouveaux échecs.
  if (isAccountLocked(state, now)) {
    return { ...state, justLocked: false };
  }
  const nextCount = state.failedLoginCount + 1;
  if (nextCount >= LOGIN_LOCK_THRESHOLD) {
    return {
      failedLoginCount: 0,
      lockedUntil: new Date(now + LOGIN_LOCK_MS),
      justLocked: true,
    };
  }
  return { failedLoginCount: nextCount, lockedUntil: null, justLocked: false };
}

/** État à écrire après une connexion réussie (remise à zéro). */
export function clearedAttemptState(): LockoutState {
  return { failedLoginCount: 0, lockedUntil: null };
}

/** `true` si l'état diffère de l'état « propre » (évite une écriture DB inutile). */
export function needsClearing(state: LockoutState): boolean {
  return state.failedLoginCount !== 0 || state.lockedUntil != null;
}
