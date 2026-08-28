import "server-only";
import { getEnv } from "@/lib/env";
import { getJobQueue } from "@/server/jobs/queue";
import { prisma } from "@/server/db/client";
import {
  runAutomationsForAllOrganizations,
  runAutomationsForOrganization,
} from "./automation-service";

/**
 * Abstraction de planification (§31). La logique métier n'est PAS liée à un
 * cron : `runDue` peut être appelé par une route interne, un worker, ou un
 * vrai scheduler. Deux implémentations selon `AUTOMATION_DISPATCH` :
 *   - "inline" / "cron" : exécute la passe directement
 *   - "queue"           : enfile un job AUTOMATION_RUN par organisation
 */

export interface AutomationScheduler {
  runDue(now?: Date): Promise<{ organizations: number; enqueued: number; totalCreated: number }>;
}

class InlineAutomationScheduler implements AutomationScheduler {
  async runDue(now: Date = new Date()) {
    const r = await runAutomationsForAllOrganizations(now);
    return { organizations: r.organizations, enqueued: 0, totalCreated: r.totalCreated };
  }
}

class QueueAutomationScheduler implements AutomationScheduler {
  async runDue(now: Date = new Date()) {
    const orgs = await prisma.organization.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    const queue = getJobQueue();
    let enqueued = 0;
    for (const o of orgs) {
      const { deduped } = await queue.enqueue({
        type: "AUTOMATION_RUN",
        organizationId: o.id,
        payload: { organizationId: o.id },
        dedupeParts: [o.id, "pass"],
        runAfter: now,
      });
      if (!deduped) enqueued++;
    }
    return { organizations: orgs.length, enqueued, totalCreated: 0 };
  }
}

let singleton: AutomationScheduler | null = null;

export function getAutomationScheduler(): AutomationScheduler {
  if (singleton) return singleton;
  singleton =
    getEnv().AUTOMATION_DISPATCH === "queue"
      ? new QueueAutomationScheduler()
      : new InlineAutomationScheduler();
  return singleton;
}

/** Exécute une passe pour UNE organisation (handler de job AUTOMATION_RUN). */
export async function runAutomationJob(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, timezone: true, currency: true, status: true },
  });
  if (!org || org.status !== "ACTIVE") return;
  await runAutomationsForOrganization({
    organizationId: org.id,
    timezone: org.timezone,
    currency: org.currency,
  });
}
