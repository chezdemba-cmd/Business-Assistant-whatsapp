"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { actionOrgContext } from "./context";
import { writeAuditLog } from "@/server/audit/log";
import { runAction, formToObject } from "./runner";
import { Conflict, Forbidden, NotFound } from "@/server/errors";
import { normalizePhone } from "@/lib/identifiers";
import { deriveDisplayName } from "@/server/crm/customer-service";
import { canAccessCustomer, canSeeAllCrm } from "@/server/crm/scope";
import {
  createCustomerSchema,
  updateCustomerSchema,
  quickCreateCustomerSchema,
  customerIdSchema,
} from "@/server/validation/schemas";
import type { ActionResult } from "@/lib/result";

async function assertAssigneeValid(
  organizationId: string,
  assignedToUserId: string | undefined,
): Promise<string | null> {
  if (!assignedToUserId) return null;
  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: assignedToUserId },
    },
    select: { status: true },
  });
  if (!member || member.status === "SUSPENDED") {
    throw NotFound("Commercial assigné introuvable dans cette entreprise.");
  }
  return assignedToUserId;
}

async function ensurePhoneFree(
  organizationId: string,
  phone: string | null,
  exceptCustomerId?: string,
): Promise<void> {
  if (!phone) return;
  const clash = await prisma.customer.findFirst({
    where: { organizationId, phone },
    select: { id: true },
  });
  if (clash && clash.id !== exceptCustomerId) {
    throw Conflict("Un client avec ce numéro existe déjà dans cette entreprise.");
  }
}

export async function createCustomerAction(
  _prev: ActionResult<{ id: string; displayName: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; displayName: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "customers.write",
      organizationId: raw.organizationId,
    });
    const input = createCustomerSchema.parse(raw);

    const phone = input.phone
      ? normalizePhone(input.phone, ctx.organization.countryCode)
      : null;
    await ensurePhoneFree(ctx.organization.id, phone);
    const assignedToUserId = await assertAssigneeValid(
      ctx.organization.id,
      input.assignedToUserId,
    );

    const displayName = deriveDisplayName(input);

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          organizationId: ctx.organization.id,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          displayName,
          phone,
          email: input.email ?? null,
          customerType: input.customerType ?? null,
          businessName: input.businessName ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          area: input.area ?? null,
          countryCode: ctx.organization.countryCode,
          notes: input.notes ?? null,
          status: "ACTIVE",
          source: "MANUAL",
          assignedToUserId,
        },
      });
      await tx.customerActivity.create({
        data: {
          organizationId: ctx.organization.id,
          customerId: created.id,
          type: "CUSTOMER_CREATED",
          title: `Client ${displayName} créé`,
          actorUserId: ctx.user.id,
        },
      });
      return created;
    });

    await writeAuditLog({
      action: "CUSTOMER_CREATED",
      entityType: "customer",
      entityId: customer.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { displayName, hasPhone: Boolean(phone) },
    });

    revalidatePath("/customers");
    revalidatePath("/dashboard");
    return { id: customer.id, displayName };
  });
}

export async function quickCreateCustomerAction(
  _prev: ActionResult<{ id: string; displayName: string; phone: string | null }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; displayName: string; phone: string | null }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "customers.write",
      organizationId: raw.organizationId,
    });
    const input = quickCreateCustomerSchema.parse(raw);
    const phone = input.phone
      ? normalizePhone(input.phone, ctx.organization.countryCode)
      : null;
    await ensurePhoneFree(ctx.organization.id, phone);

    const assignedToUserId = canSeeAllCrm(ctx.role) ? null : ctx.user.id;

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          organizationId: ctx.organization.id,
          displayName: input.displayName.trim(),
          phone,
          countryCode: ctx.organization.countryCode,
          status: "ACTIVE",
          source: "MANUAL",
          assignedToUserId,
        },
      });
      await tx.customerActivity.create({
        data: {
          organizationId: ctx.organization.id,
          customerId: created.id,
          type: "CUSTOMER_CREATED",
          title: `Client ${created.displayName} créé (rapide)`,
          actorUserId: ctx.user.id,
        },
      });
      return created;
    });

    await writeAuditLog({
      action: "CUSTOMER_CREATED",
      entityType: "customer",
      entityId: customer.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { displayName: customer.displayName, quick: true },
    });

    revalidatePath("/customers");
    return { id: customer.id, displayName: customer.displayName, phone };
  });
}

export async function updateCustomerAction(
  _prev: ActionResult<{ id: string; displayName: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; displayName: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "customers.write",
      organizationId: raw.organizationId,
    });
    const { customerId } = customerIdSchema.parse(raw);
    const input = updateCustomerSchema.parse(raw);

    const existing = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: ctx.organization.id },
    });
    if (!existing) throw NotFound("Client introuvable dans cette entreprise.");
    if (!canAccessCustomer(ctx.role, ctx.user.id, existing)) {
      throw Forbidden("Ce client ne vous est pas assigné.");
    }

    const phone = input.phone
      ? normalizePhone(input.phone, ctx.organization.countryCode)
      : null;
    await ensurePhoneFree(ctx.organization.id, phone, existing.id);
    const assignedToUserId = await assertAssigneeValid(
      ctx.organization.id,
      input.assignedToUserId,
    );
    const displayName = deriveDisplayName(input);

    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: existing.id },
        data: {
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          displayName,
          phone,
          email: input.email ?? null,
          customerType: input.customerType ?? null,
          businessName: input.businessName ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          area: input.area ?? null,
          notes: input.notes ?? null,
          assignedToUserId,
        },
      });
      await tx.customerActivity.create({
        data: {
          organizationId: ctx.organization.id,
          customerId: existing.id,
          type: "CUSTOMER_UPDATED",
          title: `Fiche client mise à jour`,
          actorUserId: ctx.user.id,
        },
      });
    });

    await writeAuditLog({
      action: "CUSTOMER_UPDATED",
      entityType: "customer",
      entityId: existing.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${existing.id}`);
    return { id: existing.id, displayName };
  });
}

async function setCustomerArchived(
  formData: FormData,
  archived: boolean,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "customers.write",
      organizationId: raw.organizationId,
    });
    const { customerId } = customerIdSchema.parse(raw);
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: ctx.organization.id },
      select: { id: true, assignedToUserId: true, displayName: true },
    });
    if (!existing) throw NotFound("Client introuvable dans cette entreprise.");
    if (!canAccessCustomer(ctx.role, ctx.user.id, existing)) {
      throw Forbidden("Ce client ne vous est pas assigné.");
    }

    await prisma.customer.update({
      where: { id: existing.id },
      data: archived
        ? { status: "ARCHIVED", archivedAt: new Date() }
        : { status: "ACTIVE", archivedAt: null },
    });
    await writeAuditLog({
      action: archived ? "CUSTOMER_ARCHIVED" : "CUSTOMER_RESTORED",
      entityType: "customer",
      entityId: existing.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { displayName: existing.displayName },
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${existing.id}`);
    return { id: existing.id };
  });
}

export async function archiveCustomerAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) {
  return setCustomerArchived(formData, true);
}

export async function restoreCustomerAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) {
  return setCustomerArchived(formData, false);
}
