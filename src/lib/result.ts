/**
 * Résultat typé pour les Server Actions : jamais d'exception brute renvoyée
 * au client, toujours `{ ok }` + message utilisateur propre.
 */
export type ActionSuccess<T> = { ok: true; data: T };
export type ActionFailure = {
  ok: false;
  error: string;
  /** Erreurs de champ, format { champ: message } — pour l'affichage inline. */
  fieldErrors?: Record<string, string>;
  code?: string;
};
export type ActionResult<T = void> = ActionSuccess<T> | ActionFailure;

export function ok<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

export function fail(
  error: string,
  opts?: { fieldErrors?: Record<string, string>; code?: string },
): ActionFailure {
  return { ok: false, error, fieldErrors: opts?.fieldErrors, code: opts?.code };
}
