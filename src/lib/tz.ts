/**
 * Fenêtre « aujourd'hui » dans le fuseau de l'organisation, sans dépendance.
 * Une entreprise Mali (Africa/Bamako, UTC+0) et une entreprise France
 * (Europe/Paris) n'ont pas le même « aujourd'hui » — on ne peut pas se
 * contenter d'un `date_trunc` UTC.
 */

function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  return asUtc - date.getTime();
}

/** Intervalle `[gte, lt[` couvrant le jour courant dans `timeZone`. */
export function todayRange(
  timeZone: string,
  now: Date = new Date(),
): { gte: Date; lt: Date } {
  let tz = timeZone;
  try {
    // Valide le fuseau ; repli UTC si inconnu.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = "UTC";
  }
  const offset = tzOffsetMs(now, tz);
  const local = new Date(now.getTime() + offset);
  const startLocalAsUtc = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  const gte = new Date(startLocalAsUtc - offset);
  const lt = new Date(startLocalAsUtc - offset + 24 * 60 * 60 * 1000);
  return { gte, lt };
}
