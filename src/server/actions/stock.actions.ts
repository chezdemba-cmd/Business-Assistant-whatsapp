"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type StockMovementType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { actionOrgContext } from "./context";
import { writeAuditLog } from "@/server/audit/log";
import { runAction, formToObject } from "./runner";
import { Conflict, NotFound } from "@/server/errors";
import {
  inventoryAdjustment,
  reversalTypeFor,
} from "@/server/stock/movement-rules";
import { getPhysicalStock, getStockSnapshot } from "@/server/stock/stock-service";
import {
  stockMovementSchema,
  reverseMovementSchema,
} from "@/server/validation/schemas";
import type { ActionResult } from "@/lib/result";

type MovementResult = {
  movementId: string | null;
  physical: number;
  unchanged: boolean;
};

/**
 * Enregistre un mouvement de stock.
 *  - mode "quantity"  : type + quantité saisis.
 *  - mode "inventory" : le client fournit le stock COMPTÉ, le serveur calcule
 *    le delta (ADJUSTMENT_IN/OUT) — le client ne décide jamais du delta.
 */
export async function recordStockMovementAction(
  _prev: ActionResult<MovementResult> | null,
  formData: FormData,
): Promise<ActionResult<MovementResult>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "stock.write",
      organizationId: raw.organizationId,
    });
    const input = stockMovementSchema.parse(raw);

    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: ctx.organization.id },
      select: {
        id: true,
        status: true,
        alertThreshold: true,
        purchasePrice: true,
      },
    });
    if (!product) throw NotFound("Produit introuvable dans cette entreprise.");
    if (product.status === "ARCHIVED") {
      throw Conflict("Produit archivé — aucun mouvement possible.");
    }

    const outcome = await prisma.$transaction(
      async (tx) => {
        let type: StockMovementType;
        let quantity: number;
        let metadata: Record<string, unknown>;
        let previousPhysical: number | null = null;

        if (input.mode === "inventory") {
          previousPhysical = await getPhysicalStock(
            ctx.organization.id,
            product.id,
            tx,
          );
          const adj = inventoryAdjustment(previousPhysical, input.countedStock);
          if (!adj) {
            return { movement: null, previousPhysical, unchanged: true as const };
          }
          type = adj.type;
          quantity = adj.quantity;
          metadata = {
            mode: "inventory",
            previousPhysicalStock: previousPhysical,
            countedStock: input.countedStock,
          };
        } else {
          type = input.type;
          quantity = input.quantity;
          metadata = { mode: "quantity" };
        }

        const movement = await tx.stockMovement.create({
          data: {
            organizationId: ctx.organization.id,
            productId: product.id,
            type,
            quantity,
            reason: input.reason ?? null,
            reference: input.reference ?? null,
            actorUserId: ctx.user.id,
            metadata: metadata as Prisma.InputJsonValue,
          },
        });
        return { movement, previousPhysical, unchanged: false as const };
      },
      { isolationLevel: "Serializable" },
    );

    if (outcome.unchanged || !outcome.movement) {
      return {
        movementId: null,
        physical: outcome.previousPhysical ?? 0,
        unchanged: true,
      };
    }

    await writeAuditLog({
      action:
        input.mode === "inventory"
          ? "STOCK_INVENTORY_ADJUSTED"
          : "STOCK_MOVEMENT_RECORDED",
      entityType: "stock_movement",
      entityId: outcome.movement.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: {
        productId: product.id,
        type: outcome.movement.type,
        quantity: outcome.movement.quantity,
        ...(input.mode === "inventory"
          ? {
              previousPhysicalStock: outcome.previousPhysical,
              countedStock: input.countedStock,
            }
          : {}),
      },
    });

    const snapshot = await getStockSnapshot(ctx.organization.id, product);

    revalidatePath("/stock");
    revalidatePath("/stock/movements");
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${product.id}`);
    return { movementId: outcome.movement.id, physical: snapshot.physical, unchanged: false };
  });
}

/**
 * Annule un mouvement historique par un mouvement COMPENSATOIRE.
 * Le mouvement d'origine reste immuable et visible.
 */
export async function reverseStockMovementAction(
  _prev: ActionResult<{ movementId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ movementId: string }>> {
  return runAction(async () => {
    const raw = formToObject(formData);
    const ctx = await actionOrgContext({
      permission: "stock.write",
      organizationId: raw.organizationId,
    });
    const input = reverseMovementSchema.parse(raw);

    const original = await prisma.stockMovement.findFirst({
      where: { id: input.movementId, organizationId: ctx.organization.id },
    });
    if (!original) throw NotFound("Mouvement introuvable dans cette entreprise.");
    if (original.type === "INITIAL") {
      throw Conflict("Le mouvement de stock initial ne peut pas être annulé.");
    }

    const reversal = await prisma.stockMovement.create({
      data: {
        organizationId: ctx.organization.id,
        productId: original.productId,
        type: reversalTypeFor(original.type),
        quantity: original.quantity,
        reason:
          input.reason ?? `Annulation du mouvement ${original.type} (${original.id})`,
        reference: original.reference,
        actorUserId: ctx.user.id,
        metadata: { reverses: original.id, originalType: original.type },
      },
    });

    await writeAuditLog({
      action: "STOCK_MOVEMENT_REVERSED",
      entityType: "stock_movement",
      entityId: reversal.id,
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      metadata: {
        reverses: original.id,
        originalType: original.type,
        quantity: original.quantity,
      },
    });

    revalidatePath("/stock");
    revalidatePath("/stock/movements");
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${original.productId}`);
    return { movementId: reversal.id };
  });
}
