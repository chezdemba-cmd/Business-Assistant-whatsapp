import type { Role } from "@prisma/client";
import { can, type Permission } from "../rbac/permissions.ts";

/**
 * Qui agit derrière une exécution IA.
 *  - USER      : le commerçant dans l'assistant `/ai` — permissions de son rôle.
 *  - SYSTEM_AI : l'IA répond au nom de l'organisation sur WhatsApp. Jeu de
 *    permissions FIGÉ et restreint. Jamais OWNER. Aucun accès paiements /
 *    stock write / membres / settings / billing. Lecture client limitée au
 *    client de la conversation.
 */
export type AiPrincipal =
  | { kind: "USER"; userId: string; role: Role }
  | { kind: "SYSTEM_AI"; conversationCustomerId: string | null };

const SYSTEM_AI_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "catalog.read",
  "stock.read",
  "customers.read",
  "orders.read",
  "conversations.write",
]);

export function principalCan(p: AiPrincipal, permission: Permission): boolean {
  if (p.kind === "USER") return can(p.role, permission);
  return SYSTEM_AI_PERMISSIONS.has(permission);
}

export function principalLabel(p: AiPrincipal): string {
  return p.kind === "USER" ? `user:${p.userId}` : "system_ai";
}
