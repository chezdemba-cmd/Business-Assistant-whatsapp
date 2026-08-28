import "server-only";
import type { JobType, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logError } from "@/server/errors";
import { getEnv } from "@/lib/env";
import {
  failureStatus,
  jobDedupeKey,
  nextRunAfter,
} from "./retry";

/**
 * Abstraction de file de jobs (§32-33). Aujourd'hui : un adapter in-process
 * adossé à la table `jobs`. Demain : BullMQ + Redis, ou toute autre queue —
 * il suffira de fournir une autre implémentation de `JobQueue`, sans toucher
 * aux producteurs ni aux handlers.
 *
 * Les dispatchers inline existants (IA, Voice) restent en place ; ils peuvent
 * migrer progressivement vers cette file (`enqueue` + handler).
 */

export type EnqueueInput = {
  type: JobType;
  payload: Prisma.InputJsonValue;
  organizationId?: string | null;
  /** Parts identifiant logiquement le job → enqueue idempotent tant qu'il n'est pas fini. */
  dedupeParts?: Array<string | number | null | undefined>;
  runAfter?: Date;
  maxAttempts?: number;
};

export type ClaimedJob = {
  id: string;
  type: JobType;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  organizationId: string | null;
};

export interface JobQueue {
  enqueue(input: EnqueueInput): Promise<{ id: string; deduped: boolean }>;
  claimNext(now?: Date): Promise<ClaimedJob | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, error: string, now?: Date): Promise<void>;
}

const ACTIVE = ["PENDING", "RUNNING"] as const;

class InProcessJobQueue implements JobQueue {
  async enqueue(input: EnqueueInput): Promise<{ id: string; deduped: boolean }> {
    const maxAttempts = input.maxAttempts ?? getEnv().JOB_MAX_ATTEMPTS;
    const dedupeKey = input.dedupeParts
      ? jobDedupeKey(input.type, input.dedupeParts)
      : null;

    if (dedupeKey) {
      const existing = await prisma.job.findFirst({
        where: { dedupeKey, status: { in: [...ACTIVE] } },
        select: { id: true },
      });
      if (existing) return { id: existing.id, deduped: true };
    }

    try {
      const job = await prisma.job.create({
        data: {
          type: input.type,
          payload: input.payload,
          organizationId: input.organizationId ?? null,
          runAfter: input.runAfter ?? new Date(),
          maxAttempts,
          dedupeKey,
        },
        select: { id: true },
      });
      return { id: job.id, deduped: false };
    } catch (err) {
      // Course sur dedupeKey unique → renvoyer le job concurrent.
      if (dedupeKey) {
        const again = await prisma.job.findFirst({
          where: { dedupeKey, status: { in: [...ACTIVE] } },
          select: { id: true },
        });
        if (again) return { id: again.id, deduped: true };
      }
      throw err;
    }
  }

  async claimNext(now: Date = new Date()): Promise<ClaimedJob | null> {
    // Verrouillage optimiste : on tente un updateMany ciblé sur un id PENDING.
    const candidate = await prisma.job.findFirst({
      where: { status: "PENDING", runAfter: { lte: now } },
      orderBy: { runAfter: "asc" },
      select: { id: true },
    });
    if (!candidate) return null;

    const claimed = await prisma.job.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: { status: "RUNNING", lockedAt: now, attempts: { increment: 1 } },
    });
    if (claimed.count === 0) return null; // pris par un autre worker

    const job = await prisma.job.findUnique({ where: { id: candidate.id } });
    if (!job) return null;
    return {
      id: job.id,
      type: job.type,
      payload: job.payload,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      organizationId: job.organizationId,
    };
  }

  async complete(jobId: string): Promise<void> {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "COMPLETED", completedAt: new Date(), lockedAt: null, lastError: null },
    });
  }

  async fail(jobId: string, error: string, now: Date = new Date()): Promise<void> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { attempts: true, maxAttempts: true },
    });
    if (!job) return;
    const status = failureStatus(job.attempts, job.maxAttempts);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        lockedAt: null,
        lastError: error.slice(0, 500),
        ...(status === "FAILED"
          ? { status: "PENDING", runAfter: nextRunAfter(now, job.attempts) }
          : {}),
      },
    });
  }
}

let singleton: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!singleton) singleton = new InProcessJobQueue();
  return singleton;
}

// ─────────────────────────── Handlers & runner ───────────────────────────

export type JobHandler = (payload: unknown, ctx: { organizationId: string | null }) => Promise<void>;

const handlers = new Map<JobType, JobHandler>();

export function registerJobHandler(type: JobType, handler: JobHandler): void {
  handlers.set(type, handler);
}

/**
 * Traite jusqu'à `limit` jobs prêts. Retourne un compte-rendu. Ne jette pas :
 * un job qui échoue est marqué FAILED (retry) ou DEAD (essais épuisés).
 */
export async function runPendingJobs(
  limit = 25,
  now: Date = new Date(),
): Promise<{ processed: number; completed: number; failed: number }> {
  const queue = getJobQueue();
  let processed = 0;
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < limit; i++) {
    const job = await queue.claimNext(now);
    if (!job) break;
    processed++;
    const handler = handlers.get(job.type);
    if (!handler) {
      await queue.fail(job.id, `Aucun handler pour ${job.type}`, now);
      failed++;
      continue;
    }
    try {
      await handler(job.payload, { organizationId: job.organizationId });
      await queue.complete(job.id);
      completed++;
    } catch (err) {
      logError("job.handler", { type: job.type, error: err instanceof Error ? err.message : "unknown" });
      await queue.fail(job.id, err instanceof Error ? err.message : "unknown", now);
      failed++;
    }
  }
  return { processed, completed, failed };
}
