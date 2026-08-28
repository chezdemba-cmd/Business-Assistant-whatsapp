"use server";

import { revalidatePath } from "next/cache";
import type { PlanCode, SubscriptionStatus } from "@prisma/client";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";
import { requireSuperAdminAction } from "@/server/admin/guard";
import { togglePilot } from "@/server/admin/console-service";
import {
  setPlan,
  setSubscriptionStatus,
} from "@/server/billing/subscription-service";
import { revokeAllSessions } from "@/server/auth/revocation";
import { prisma } from "@/server/db/client";

const PLAN_CODES: PlanCode[] = ["STARTER", "BUSINESS", "PRO"];
const SUB_STATUSES: SubscriptionStatus[] = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
  "SUSPENDED",
];

export async function adminSetPlanAction(
  _p: ActionResult<{ ok: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const admin = await requireSuperAdminAction();
    const raw = formToObject(formData);
    const planCode = raw.planCode as PlanCode;
    if (!PLAN_CODES.includes(planCode)) throw new Error("Offre inconnue.");
    await setPlan({ organizationId: raw.organizationId ?? "", planCode, actorUserId: admin.id });
    revalidatePath(`/admin/${raw.organizationId}`);
    revalidatePath("/admin");
    return { ok: true as const };
  });
}

export async function adminSetSubscriptionStatusAction(
  _p: ActionResult<{ ok: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const admin = await requireSuperAdminAction();
    const raw = formToObject(formData);
    const status = raw.status as SubscriptionStatus;
    if (!SUB_STATUSES.includes(status)) throw new Error("Statut inconnu.");
    await setSubscriptionStatus({
      organizationId: raw.organizationId ?? "",
      status,
      actorUserId: admin.id,
    });
    revalidatePath(`/admin/${raw.organizationId}`);
    return { ok: true as const };
  });
}

export async function adminTogglePilotAction(
  _p: ActionResult<{ ok: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    await requireSuperAdminAction();
    const raw = formToObject(formData);
    await togglePilot(raw.organizationId ?? "", raw.isPilot === "1");
    revalidatePath(`/admin/${raw.organizationId}`);
    revalidatePath("/admin");
    return { ok: true as const };
  });
}

/** Force la déconnexion de tous les appareils d'un utilisateur (appareil compromis). */
export async function adminRevokeUserSessionsAction(
  _p: ActionResult<{ ok: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const admin = await requireSuperAdminAction();
    const raw = formToObject(formData);
    const email = (raw.email ?? "").trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error("Utilisateur introuvable.");
    await revokeAllSessions(user.id, { actorUserId: admin.id, reason: "operator_revoke" });
    return { ok: true as const };
  });
}
