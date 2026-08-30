import "server-only";
import { prisma } from "@/server/db/client";
import { logger } from "@/lib/logger";
import { expireEndedTrials } from "@/server/billing/subscription-service";
import { shouldRetry } from "@/server/jobs/retry";

/**
 * Tâches d'entretien périodiques (§10). Idempotentes, sans effet externe.
 * Exécutées par le worker / le scheduler, jamais dans une requête utilisateur.
 */

const DRAFT_TTL_DAYS = 7;
/** Un job `RUNNING` verrouillé depuis plus longtemps est considéré orphelin
 *  (worker tué en plein traitement). Aligné sur le seuil de `/api/health`. */
const STUCK_JOB_MS = 10 * 60_000;

export type MaintenanceResult = {
  reservationsExpired: number;
  draftsExpired: number;
  proposalsExpired: number;
  recommendationsExpired: number;
  trialsEnded: number;
  deletionsCompleted: number;
  jobsRequeued: number;
  jobsDead: number;
};

export async function runMaintenance(now: Date = new Date()): Promise<MaintenanceResult> {
  const res: MaintenanceResult = {
    reservationsExpired: 0,
    draftsExpired: 0,
    proposalsExpired: 0,
    recommendationsExpired: 0,
    trialsEnded: 0,
    deletionsCompleted: 0,
    jobsRequeued: 0,
    jobsDead: 0,
  };

  // Jobs orphelins : `RUNNING` verrouillés depuis > STUCK_JOB_MS (worker
  // interrompu). Ceux qui ont encore des essais repartent en PENDING ; les
  // autres passent DEAD. `attempts` a déjà été incrémenté à la prise du verrou.
  const stuckJobs = await prisma.job.findMany({
    where: {
      status: "RUNNING",
      lockedAt: { not: null, lt: new Date(now.getTime() - STUCK_JOB_MS) },
    },
    select: { id: true, attempts: true, maxAttempts: true },
  });
  const requeueIds = stuckJobs
    .filter((j) => shouldRetry(j.attempts, j.maxAttempts))
    .map((j) => j.id);
  const deadIds = stuckJobs
    .filter((j) => !shouldRetry(j.attempts, j.maxAttempts))
    .map((j) => j.id);
  if (requeueIds.length > 0) {
    res.jobsRequeued = (
      await prisma.job.updateMany({
        where: { id: { in: requeueIds }, status: "RUNNING" },
        data: { status: "PENDING", lockedAt: null, runAfter: now, lastError: "requeued: stuck RUNNING" },
      })
    ).count;
  }
  if (deadIds.length > 0) {
    res.jobsDead = (
      await prisma.job.updateMany({
        where: { id: { in: deadIds }, status: "RUNNING" },
        data: { status: "DEAD", lockedAt: null, lastError: "dead: stuck RUNNING, attempts exhausted" },
      })
    ).count;
  }

  // Réservations de stock arrivées à expiration.
  res.reservationsExpired = (
    await prisma.stockReservation.updateMany({
      where: { status: "ACTIVE", expiresAt: { not: null, lt: now } },
      data: { status: "EXPIRED", releasedAt: now },
    })
  ).count;

  // Brouillons de commande abandonnés.
  const draftCutoff = new Date(now.getTime() - DRAFT_TTL_DAYS * 86_400_000);
  res.draftsExpired = (
    await prisma.orderDraft.updateMany({
      where: {
        updatedAt: { lt: draftCutoff },
        status: { in: ["DRAFT", "AWAITING_CUSTOMER_CONFIRMATION", "CUSTOMER_CONFIRMED", "AWAITING_HUMAN_APPROVAL"] },
      },
      data: { status: "EXPIRED" },
    })
  ).count;

  // Propositions d'action IA non confirmées, échéance dépassée.
  res.proposalsExpired = (
    await prisma.aiActionProposal.updateMany({
      where: { status: "PENDING", expiresAt: { not: null, lt: now } },
      data: { status: "EXPIRED" },
    })
  ).count;

  // Recommandations dont la date d'expiration explicite est passée.
  res.recommendationsExpired = (
    await prisma.businessRecommendation.updateMany({
      where: {
        status: { in: ["NEW", "VIEWED", "ACTION_PREPARED"] },
        expiresAt: { not: null, lt: now },
      },
      data: { status: "EXPIRED" },
    })
  ).count;

  // Essais échus → PAST_DUE (n'interrompt pas brutalement le service, §19).
  res.trialsEnded = await expireEndedTrials(now);

  // Demandes de suppression : fin de période de grâce → à traiter (purge
  // administrative). On marque COMPLETED, la purge réelle reste manuelle.
  res.deletionsCompleted = (
    await prisma.organizationDeletionRequest.updateMany({
      where: { status: { in: ["REQUESTED", "GRACE_PERIOD"] }, purgeAfter: { lt: now } },
      data: { status: "COMPLETED", completedAt: now },
    })
  ).count;

  logger.info("maintenance.run", { service: "maintenance", event: "completed", ...res });
  return res;
}
