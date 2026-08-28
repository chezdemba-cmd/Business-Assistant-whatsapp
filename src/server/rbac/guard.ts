import type { Role } from "@prisma/client";
import { Forbidden } from "@/server/errors";
import { can, canAny, type Permission } from "./permissions";

/**
 * Contrôle serveur d'une permission. Toujours appelé côté serveur en
 * complément du masquage d'UI — jamais uniquement dans le front.
 */
export function requirePermission(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw Forbidden(
      `Cette action requiert la permission « ${permission} », non accordée au rôle ${role}.`,
    );
  }
}

export function requireAnyPermission(role: Role, permissions: Permission[]): void {
  if (!canAny(role, permissions)) {
    throw Forbidden(
      `Cette action requiert l'une des permissions ${permissions
        .map((p) => `« ${p} »`)
        .join(", ")}.`,
    );
  }
}
