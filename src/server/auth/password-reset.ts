import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

/**
 * Token de réinitialisation de mot de passe — STATELESS (§9), pas de table.
 *
 *  - Signé HS256 avec une clé DÉRIVÉE d'`AUTH_SESSION_SECRET` (séparation de
 *    domaine : un token de reset ne peut pas être rejoué comme cookie de
 *    session, et inversement).
 *  - TTL court (1 h).
 *  - USAGE UNIQUE : embarque `pwAt` = `user.passwordChangedAt` (ms). La
 *    réinitialisation met `passwordChangedAt = now` → tout token émis avant
 *    devient invalide (`pwAt` ne correspond plus). Idem si l'utilisateur a
 *    changé son mot de passe entre-temps.
 */

const RESET_TTL_SECONDS = 60 * 60;
const PURPOSE = "pwreset" as const;

function resetKey(): Uint8Array {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET manquant ou trop court : token de réinitialisation impossible.");
  }
  // Clé distincte de celle des sessions.
  return new Uint8Array(
    createHmac("sha256", secret).update("djeli/password-reset/v1").digest(),
  );
}

export type ResetClaims = { userId: string; pwAtMs: number };

/** `passwordChangedAt` peut être null (compte sans changement) → 0. */
export async function issuePasswordResetToken(
  userId: string,
  passwordChangedAt: Date | null,
): Promise<string> {
  return new SignJWT({ purpose: PURPOSE, pwAt: passwordChangedAt?.getTime() ?? 0 })
    .setSubject(userId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS)
    .sign(resetKey());
}

/** Signature + expiration + `purpose` valides → claims, sinon null. */
export async function verifyPasswordResetToken(
  token: string,
): Promise<ResetClaims | null> {
  try {
    const { payload } = await jwtVerify(token, resetKey(), { algorithms: ["HS256"] });
    if (payload.purpose !== PURPOSE) return null;
    if (typeof payload.sub !== "string") return null;
    const pwAt = typeof payload.pwAt === "number" ? payload.pwAt : NaN;
    if (!Number.isFinite(pwAt)) return null;
    return { userId: payload.sub, pwAtMs: pwAt };
  } catch {
    return null;
  }
}

/** Le token est-il toujours frais vis-à-vis de l'état actuel du compte ? */
export function resetTokenMatchesAccount(
  claims: ResetClaims,
  passwordChangedAt: Date | null,
): boolean {
  return claims.pwAtMs === (passwordChangedAt?.getTime() ?? 0);
}
