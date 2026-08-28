import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { Unauthenticated } from "@/server/errors";
import { readSession } from "./session";
import { isSessionStillValid } from "./session-policy";

/**
 * Utilisateur connecté ou null. Mémoïsé par requête via React.cache
 * pour éviter de multiples hits DB dans un même rendu.
 *
 * Révocation « douce » : toute session émise AVANT `user.passwordChangedAt`
 * est rejetée (invalidation de toutes les sessions au changement de mot de
 * passe, sans table de sessions — cf. dette technique).
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status === "DISABLED") return null;
  // Révocation : mot de passe changé, ou révocation globale explicite (§5) —
  // « déconnecter tous les appareils », suspension, appareil compromis.
  if (
    !isSessionStillValid(session.issuedAtMs, {
      passwordChangedAt: user.passwordChangedAt,
      sessionInvalidBefore: user.sessionInvalidBefore,
    })
  ) {
    return null;
  }
  return user;
});

/** Pour les pages : redirige vers /login si non connecté. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Pour les Server Actions : jette une AppError au lieu de rediriger. */
export async function requireUserOrThrow(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw Unauthenticated();
  return user;
}
