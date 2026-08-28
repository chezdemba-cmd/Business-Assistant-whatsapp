import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { requireUserOrThrow, getCurrentUser } from "@/server/auth/current-user";
import { getEnv } from "@/lib/env";
import { Forbidden } from "@/server/errors";

/**
 * Console opérateur Djeli (§22) — STRICTEMENT séparée des admins
 * d'organisation. Un opérateur a `isSuperAdmin=true` OU son e-mail figure dans
 * `DJELI_SUPERADMIN_EMAILS`. Aucun accès au contenu privé des tenants.
 */
import { isSuperAdminUser, parseAllowlist } from "./superadmin.ts";
export { isSuperAdminUser, parseAllowlist } from "./superadmin.ts";

export function isSuperAdmin(user: Pick<User, "isSuperAdmin" | "email">): boolean {
  return isSuperAdminUser(user, parseAllowlist(getEnv().DJELI_SUPERADMIN_EMAILS));
}

/** Page : redirige vers /dashboard si l'utilisateur n'est pas opérateur. */
export async function requireSuperAdminPage(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user)) redirect("/dashboard");
  return user;
}

/** Server Action : jette une AppError. */
export async function requireSuperAdminAction(): Promise<User> {
  const user = await requireUserOrThrow();
  if (!isSuperAdmin(user)) throw Forbidden("Réservé aux opérateurs Djeli.");
  return user;
}
