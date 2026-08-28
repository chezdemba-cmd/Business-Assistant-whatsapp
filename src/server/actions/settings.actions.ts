"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { actionOrgContext } from "./context";
import { writeAuditLog } from "@/server/audit/log";
import { updateOrganizationSchema } from "@/server/validation/schemas";
import { normalizePhone } from "@/lib/identifiers";
import { runAction, formToObject } from "./runner";
import type { ActionResult } from "@/lib/result";

export async function updateOrganizationSettingsAction(
  _prev: ActionResult<{ saved: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const organizationId = raw.organizationId;
    const ctx = await actionOrgContext({
      permission: "settings.update",
      organizationId,
    });

    const input = updateOrganizationSchema.parse(raw);

    const before = ctx.organization;
    await prisma.organization.update({
      where: { id: ctx.organization.id },
      data: {
        name: input.name,
        phone: input.phone ? normalizePhone(input.phone, input.countryCode) : null,
        email: input.email ?? null,
        countryCode: input.countryCode,
        currency: input.currency,
        timezone: input.timezone,
        addressLine: input.addressLine ?? null,
        city: input.city ?? null,
        district: input.district ?? null,
        businessType: input.businessType,
      },
    });

    const changed: string[] = [];
    for (const key of [
      "name",
      "countryCode",
      "currency",
      "timezone",
      "businessType",
    ] as const) {
      if (before[key] !== input[key]) changed.push(key);
    }

    await writeAuditLog({
      action: "SETTINGS_UPDATED",
      entityType: "organization",
      entityId: ctx.organization.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { changedFields: changed },
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { saved: true };
  });
}
