import "server-only";
import type {
  Plan,
  PlanCode,
  Prisma,
  Subscription,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { getEnv } from "@/lib/env";
import { writeAuditLog } from "@/server/audit/log";
import { NotFound } from "@/server/errors";
import { PLAN_DEFS, PLAN_ORDER } from "./plans.ts";
import type { Feature } from "./features.ts";

/**
 * Abonnements (§15-19). Une organisation = une `Subscription`. Un nouvel
 * abonnement démarre en `TRIAL` sur l'offre BUSINESS (le pilote doit pouvoir
 * tout tester), pour `TRIAL_DAYS` jours.
 */

const DEFAULT_TRIAL_PLAN: PlanCode = "BUSINESS";

export type SubContext = {
  planCode: PlanCode;
  status: SubscriptionStatus;
  featureOverrides?: Partial<Record<Feature, boolean>> | null;
  limitOverrides?: Prisma.JsonValue | null;
};

/** Assure la présence des 3 lignes `Plan` (idempotent). */
export async function ensurePlans(): Promise<void> {
  for (const code of PLAN_ORDER) {
    const def = PLAN_DEFS[code];
    await prisma.plan.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: def.name,
        description: def.description,
        priceMonthly: def.priceMonthly,
        currency: def.currency,
        limits: def.limits as Prisma.InputJsonValue,
        features: def.features as Prisma.InputJsonValue,
        sortOrder: def.sortOrder,
      },
    });
  }
}

function monthLater(from: Date): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export async function getOrCreateSubscription(
  organizationId: string,
  opts: { planCode?: PlanCode; now?: Date } = {},
): Promise<Subscription & { plan: Plan }> {
  const existing = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });
  if (existing) return existing;

  await ensurePlans();
  const now = opts.now ?? new Date();
  const planCode = opts.planCode ?? DEFAULT_TRIAL_PLAN;
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: planCode } });
  const trialEndsAt = new Date(now.getTime() + getEnv().TRIAL_DAYS * 86_400_000);

  return prisma.subscription.create({
    data: {
      organizationId,
      planId: plan.id,
      status: "TRIAL",
      billingProvider: getEnv().BILLING_PROVIDER,
      startedAt: now,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: monthLater(now),
    },
    include: { plan: true },
  });
}

export async function getSubscriptionContext(
  organizationId: string,
): Promise<SubContext> {
  const sub = await getOrCreateSubscription(organizationId);
  return {
    planCode: sub.plan.code,
    status: sub.status,
    featureOverrides: (sub.featureOverrides ?? null) as SubContext["featureOverrides"],
    limitOverrides: sub.limitOverrides ?? null,
  };
}

export type SubscriptionSummary = {
  planCode: PlanCode;
  planName: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  daysLeftInTrial: number | null;
  isTrialExpired: boolean;
  currentPeriodEnd: Date | null;
  billingProvider: string;
};

export async function getSubscriptionSummary(
  organizationId: string,
  now: Date = new Date(),
): Promise<SubscriptionSummary> {
  const sub = await getOrCreateSubscription(organizationId, { now });
  const daysLeft =
    sub.status === "TRIAL" && sub.trialEndsAt
      ? Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000)
      : null;
  return {
    planCode: sub.plan.code,
    planName: sub.plan.name,
    status: sub.status,
    trialEndsAt: sub.trialEndsAt,
    daysLeftInTrial: daysLeft,
    isTrialExpired:
      sub.status === "TRIAL" && !!sub.trialEndsAt && sub.trialEndsAt.getTime() < now.getTime(),
    currentPeriodEnd: sub.currentPeriodEnd,
    billingProvider: sub.billingProvider,
  };
}

// ─────────────────── Mutations (console opérateur) ───────────────────

export async function setPlan(input: {
  organizationId: string;
  planCode: PlanCode;
  actorUserId: string;
}): Promise<void> {
  await ensurePlans();
  const plan = await prisma.plan.findUnique({ where: { code: input.planCode } });
  if (!plan) throw NotFound("Offre inconnue.");
  await getOrCreateSubscription(input.organizationId);
  await prisma.subscription.update({
    where: { organizationId: input.organizationId },
    data: { planId: plan.id },
  });
  await writeAuditLog({
    action: "SETTINGS_UPDATED",
    entityType: "subscription",
    entityId: input.organizationId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { change: "plan", planCode: input.planCode },
  });
}

export async function setSubscriptionStatus(input: {
  organizationId: string;
  status: SubscriptionStatus;
  actorUserId: string;
}): Promise<void> {
  await getOrCreateSubscription(input.organizationId);
  await prisma.subscription.update({
    where: { organizationId: input.organizationId },
    data: {
      status: input.status,
      ...(input.status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
    },
  });
  await writeAuditLog({
    action: "SETTINGS_UPDATED",
    entityType: "subscription",
    entityId: input.organizationId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    metadata: { change: "status", status: input.status },
  });
}

/** Fait passer les essais échus en `PAST_DUE` (job de maintenance). */
export async function expireEndedTrials(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.subscription.updateMany({
    where: { status: "TRIAL", trialEndsAt: { lt: now } },
    data: { status: "PAST_DUE" },
  });
  return count;
}
