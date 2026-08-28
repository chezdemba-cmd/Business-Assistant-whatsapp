"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { actionOrgContext } from "./context";
import { writeAuditLog } from "@/server/audit/log";
import { runAction, formToObject } from "./runner";
import { Conflict, NotFound } from "@/server/errors";
import { normalizeSku, isValidSku } from "@/server/stock/sku";
import { slugify, shortId } from "@/lib/identifiers";
import {
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
  productIdSchema,
} from "@/server/validation/schemas";
import type { ActionResult } from "@/lib/result";

async function resolveCategory(
  organizationId: string,
  categoryId: string | undefined,
): Promise<string | null> {
  if (!categoryId) return null;
  const category = await prisma.productCategory.findFirst({
    where: { id: categoryId, organizationId },
    select: { id: true },
  });
  if (!category) throw NotFound("Catégorie introuvable dans cette entreprise.");
  return category.id;
}

function cleanSku(raw: string): string {
  const sku = normalizeSku(raw);
  if (!isValidSku(sku)) {
    throw Conflict(
      "SKU invalide (lettres, chiffres, point et tiret uniquement).",
    );
  }
  return sku;
}

// ── Catégories ───────────────────────────────────────────────────────

export async function createCategoryAction(
  _prev: ActionResult<{ id: string; name: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "catalog.write",
      organizationId: raw.organizationId,
    });
    const input = createCategorySchema.parse(raw);

    const base = slugify(input.name);
    let slug = base;
    for (let i = 0; i < 5; i++) {
      const clash = await prisma.productCategory.findUnique({
        where: {
          organizationId_slug: { organizationId: ctx.organization.id, slug },
        },
        select: { id: true },
      });
      if (!clash) break;
      slug = `${base}-${shortId(4)}`;
    }

    const category = await prisma.productCategory.create({
      data: {
        organizationId: ctx.organization.id,
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
      },
    });

    await writeAuditLog({
      action: "CATEGORY_CREATED",
      entityType: "product_category",
      entityId: category.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { name: category.name },
    });

    revalidatePath("/catalog");
    return { id: category.id, name: category.name };
  });
}

// ── Produits ─────────────────────────────────────────────────────────

export async function createProductAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "catalog.write",
      organizationId: raw.organizationId,
    });
    const input = createProductSchema.parse(raw);

    const sku = cleanSku(input.sku);
    const categoryId = await resolveCategory(ctx.organization.id, input.categoryId);

    const existing = await prisma.product.findUnique({
      where: { organizationId_sku: { organizationId: ctx.organization.id, sku } },
      select: { id: true },
    });
    if (existing) {
      throw Conflict(`Un produit porte déjà le SKU ${sku} dans cette entreprise.`);
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          organizationId: ctx.organization.id,
          sku,
          name: input.name.trim(),
          description: input.description ?? null,
          categoryId,
          unit: input.unit,
          unitLabel: input.unit === "OTHER" ? (input.unitLabel ?? null) : null,
          salePrice: input.salePrice,
          purchasePrice: input.purchasePrice ?? null,
          alertThreshold: input.alertThreshold,
          supplierName: input.supplierName ?? null,
          barcode: input.barcode ?? null,
          photoUrl: input.photoUrl ?? null,
          status: "ACTIVE",
        },
      });
      if (input.initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            organizationId: ctx.organization.id,
            productId: created.id,
            type: "INITIAL",
            quantity: input.initialStock,
            reason: "Stock initial",
            actorUserId: ctx.user.id,
            metadata: { source: "product_creation" },
          },
        });
      }
      return created;
    });

    await writeAuditLog({
      action: "PRODUCT_CREATED",
      entityType: "product",
      entityId: product.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { sku, name: product.name },
    });
    if (input.initialStock > 0) {
      await writeAuditLog({
        action: "STOCK_INITIALIZED",
        entityType: "product",
        entityId: product.id,
        organizationId: ctx.organization.id,
        actorUserId: ctx.user.id,
        metadata: { quantity: input.initialStock },
      });
    }

    revalidatePath("/catalog");
    revalidatePath("/stock");
    return { id: product.id };
  });
}

export async function updateProductAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "catalog.write",
      organizationId: raw.organizationId,
    });
    const productId = productIdSchema.parse(raw).productId;
    const input = updateProductSchema.parse(raw);

    const product = await prisma.product.findFirst({
      where: { id: productId, organizationId: ctx.organization.id },
    });
    if (!product) throw NotFound("Produit introuvable dans cette entreprise.");
    if (product.status === "ARCHIVED") {
      throw Conflict("Produit archivé — restaurez-le avant de le modifier.");
    }

    const sku = cleanSku(input.sku);
    if (sku !== product.sku) {
      const clash = await prisma.product.findUnique({
        where: {
          organizationId_sku: { organizationId: ctx.organization.id, sku },
        },
        select: { id: true },
      });
      if (clash && clash.id !== product.id) {
        throw Conflict(`Le SKU ${sku} est déjà utilisé.`);
      }
    }
    const categoryId = await resolveCategory(ctx.organization.id, input.categoryId);

    await prisma.product.update({
      where: { id: product.id },
      data: {
        sku,
        name: input.name.trim(),
        description: input.description ?? null,
        categoryId,
        unit: input.unit,
        unitLabel: input.unit === "OTHER" ? (input.unitLabel ?? null) : null,
        salePrice: input.salePrice,
        purchasePrice: input.purchasePrice ?? null,
        alertThreshold: input.alertThreshold,
        supplierName: input.supplierName ?? null,
        barcode: input.barcode ?? null,
        photoUrl: input.photoUrl ?? null,
      },
    });

    const changed: string[] = [];
    for (const key of ["sku", "name", "salePrice", "purchasePrice", "alertThreshold", "unit"] as const) {
      if (String(product[key] ?? "") !== String(input[key] ?? "")) changed.push(key);
    }
    await writeAuditLog({
      action: "PRODUCT_UPDATED",
      entityType: "product",
      entityId: product.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { changedFields: changed },
    });

    revalidatePath("/catalog");
    revalidatePath(`/catalog/${product.id}`);
    revalidatePath("/stock");
    return { id: product.id };
  });
}

async function setProductArchived(
  formData: FormData,
  archived: boolean,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "catalog.write",
      organizationId: raw.organizationId,
    });
    const { productId } = productIdSchema.parse(raw);

    const product = await prisma.product.findFirst({
      where: { id: productId, organizationId: ctx.organization.id },
      select: { id: true, status: true, name: true },
    });
    if (!product) throw NotFound("Produit introuvable dans cette entreprise.");

    await prisma.product.update({
      where: { id: product.id },
      data: archived
        ? { status: "ARCHIVED", archivedAt: new Date() }
        : { status: "ACTIVE", archivedAt: null },
    });

    await writeAuditLog({
      action: archived ? "PRODUCT_ARCHIVED" : "PRODUCT_RESTORED",
      entityType: "product",
      entityId: product.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: { name: product.name },
    });

    revalidatePath("/catalog");
    revalidatePath(`/catalog/${product.id}`);
    revalidatePath("/stock");
    return { id: product.id };
  });
}

export async function archiveProductAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) {
  return setProductArchived(formData, true);
}

export async function restoreProductAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) {
  return setProductArchived(formData, false);
}
