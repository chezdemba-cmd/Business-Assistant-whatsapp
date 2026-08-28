"use server";

import { revalidatePath } from "next/cache";
import { actionOrgContext } from "./context";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";
import {
  buildOrganizationExport,
  type ExportFormat,
} from "@/server/org/data-export";
import {
  cancelOrganizationDeletion,
  requestOrganizationDeletion,
} from "@/server/org/deletion-service";

export async function exportOrganizationDataAction(
  _p: ActionResult<{ filename: string; contentType: string; body: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ filename: string; contentType: string; body: string }>> {
  return runAction(async () => {
    // Export complet → réservé au propriétaire (organization.update ⊂ OWNER/ADMIN).
    const ctx = await actionOrgContext({ permission: "organization.update" });
    const raw = formToObject(formData);
    const format = (raw.format === "json" ? "json" : "csv") as ExportFormat;
    return buildOrganizationExport(ctx.organization.id, format);
  });
}

export async function requestOrgDeletionAction(
  _p: ActionResult<{ purgeAfter: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ purgeAfter: string }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "organization.delete" });
    const raw = formToObject(formData);
    const res = await requestOrganizationDeletion({
      organizationId: ctx.organization.id,
      requestedByUserId: ctx.user.id,
      reason: raw.reason || null,
    });
    revalidatePath("/settings");
    return { purgeAfter: res.purgeAfter.toISOString() };
  });
}

export async function cancelOrgDeletionAction(
  _p: ActionResult<{ ok: true }> | null,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const ctx = await actionOrgContext({ permission: "organization.delete" });
    await cancelOrganizationDeletion({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
    });
    revalidatePath("/settings");
    return { ok: true as const };
  });
}
