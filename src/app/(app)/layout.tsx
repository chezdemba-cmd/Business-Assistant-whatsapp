import type { ReactNode } from "react";
import { requireUser } from "@/server/auth/current-user";
import { requireOrgContext } from "@/server/tenant/context";
import { AppShell } from "@/components/shell/AppShell";
import { getSubscriptionSummary } from "@/server/billing/subscription-service";
import { installErrorTracking } from "@/server/observability/error-tracking";
import { getEnv } from "@/lib/env";

installErrorTracking();

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const ctx = await requireOrgContext(user);
  const sub = await getSubscriptionSummary(ctx.organization.id);
  const demoMode =
    getEnv().APP_ENV === "staging" || ctx.organization.isDemo === true;
  return (
    <AppShell
      user={ctx.user}
      organization={ctx.organization}
      role={ctx.role}
      subscription={{
        planName: sub.planName,
        status: sub.status,
        daysLeftInTrial: sub.daysLeftInTrial,
        isTrialExpired: sub.isTrialExpired,
      }}
      isPilot={ctx.organization.isPilot}
      demoMode={demoMode}
    >
      {children}
    </AppShell>
  );
}
