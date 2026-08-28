import "server-only";
import type { UsageMetric } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logError, PlanLimit } from "@/server/errors";
import { getSubscriptionContext } from "./subscription-service.ts";
import {
  checkAgainstLimit,
  limitPeriod,
  limitReachedMessage,
  type LimitCheck,
  type LimitSubscription,
} from "./limits.ts";

/**
 * Usage metering + contrôle de coût fournisseur (§13, §14, §21).
 *
 *  - `checkUsageLimit` : à appeler AVANT un service coûteux. Si refusé → aucune
 *    dépense fournisseur n'est engagée.
 *  - `recordUsage` : à appeler APRÈS, avec la consommation réelle (tokens,
 *    secondes, messages…). Incrément atomique dans `UsageCounter`.
 */

function safeTz(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function usagePeriodKey(
  metric: UsageMetric,
  timeZone: string,
  now: Date = new Date(),
): { period: "DAY" | "MONTH"; key: string } {
  const period = limitPeriod(metric);
  const tz = safeTz(timeZone);
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  return { period, key: period === "DAY" ? ymd : ymd.slice(0, 7) };
}

export async function getUsage(
  organizationId: string,
  metric: UsageMetric,
  timeZone: string,
  now: Date = new Date(),
): Promise<number> {
  const { period, key } = usagePeriodKey(metric, timeZone, now);
  const row = await prisma.usageCounter.findUnique({
    where: {
      organizationId_metric_period_periodKey: {
        organizationId,
        metric,
        period,
        periodKey: key,
      },
    },
    select: { value: true },
  });
  return row?.value ?? 0;
}

export async function recordUsage(
  organizationId: string,
  metric: UsageMetric,
  amount: number,
  timeZone: string,
  now: Date = new Date(),
): Promise<void> {
  const inc = Math.max(0, Math.round(amount));
  if (inc === 0) return;
  const { period, key } = usagePeriodKey(metric, timeZone, now);
  try {
    await prisma.usageCounter.upsert({
      where: {
        organizationId_metric_period_periodKey: {
          organizationId,
          metric,
          period,
          periodKey: key,
        },
      },
      create: { organizationId, metric, period, periodKey: key, value: inc },
      update: { value: { increment: inc } },
    });
  } catch (err) {
    // Le metering ne doit jamais casser un flux métier.
    logError("usage.record", err, { organizationId, metric });
  }
}

export async function checkUsageLimit(
  organizationId: string,
  metric: UsageMetric,
  opts: { amount?: number; timeZone: string; now?: Date },
): Promise<LimitCheck> {
  const now = opts.now ?? new Date();
  const ctx = await getSubscriptionContext(organizationId);
  const sub: LimitSubscription = {
    planCode: ctx.planCode,
    status: ctx.status,
    limitOverrides: (ctx.limitOverrides ?? null) as LimitSubscription["limitOverrides"],
  };
  const used = await getUsage(organizationId, metric, opts.timeZone, now);
  return checkAgainstLimit(sub, metric, used, opts.amount ?? 1);
}

/** Variante « barrière » : jette `PLAN_LIMIT` si le quota est atteint. */
export async function assertUsageAllowed(
  organizationId: string,
  metric: UsageMetric,
  opts: { amount?: number; timeZone: string; now?: Date },
): Promise<LimitCheck> {
  const check = await checkUsageLimit(organizationId, metric, opts);
  if (!check.allowed) throw PlanLimit(limitReachedMessage(check));
  return check;
}

export type UsageSnapshot = {
  metric: UsageMetric;
  period: "DAY" | "MONTH";
  used: number;
  limit: number | null;
};

export async function getUsageSnapshot(
  organizationId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<UsageSnapshot[]> {
  const ctx = await getSubscriptionContext(organizationId);
  const sub: LimitSubscription = {
    planCode: ctx.planCode,
    status: ctx.status,
    limitOverrides: (ctx.limitOverrides ?? null) as LimitSubscription["limitOverrides"],
  };
  const metrics: UsageMetric[] = [
    "AI_REQUESTS",
    "AI_TOKENS",
    "VOICE_SECONDS",
    "WHATSAPP_MESSAGES",
    "LANGUAGE_RESOLVES",
    "MARKETING_SENDS",
  ];
  const out: UsageSnapshot[] = [];
  for (const m of metrics) {
    const check = checkAgainstLimit(sub, m, await getUsage(organizationId, m, timeZone, now), 0);
    out.push({ metric: m, period: limitPeriod(m), used: check.used, limit: check.limit });
  }
  return out;
}
