/**
 * État réseau — PUR (§30). Petit réducteur pour piloter le bandeau
 * « Connexion perdue » / « Connexion rétablie » sans logique dans le composant.
 */

export type NetPhase = "online" | "offline" | "reconnected";

export type NetState = { phase: NetPhase; sinceOnline: boolean };

export const initialNetState: NetState = { phase: "online", sinceOnline: true };

export function netReducer(
  state: NetState,
  event: "ONLINE" | "OFFLINE" | "DISMISS",
): NetState {
  switch (event) {
    case "OFFLINE":
      return { phase: "offline", sinceOnline: false };
    case "ONLINE":
      // Ne montre « rétablie » que si on venait vraiment d'être hors ligne.
      return state.phase === "offline"
        ? { phase: "reconnected", sinceOnline: true }
        : { phase: "online", sinceOnline: true };
    case "DISMISS":
      return state.phase === "reconnected"
        ? { phase: "online", sinceOnline: true }
        : state;
  }
}

export function netBanner(state: NetState): { text: string; tone: "error" | "ok" } | null {
  if (state.phase === "offline") {
    return { text: "Connexion perdue — certaines actions sont indisponibles.", tone: "error" };
  }
  if (state.phase === "reconnected") {
    return { text: "Connexion rétablie.", tone: "ok" };
  }
  return null;
}
