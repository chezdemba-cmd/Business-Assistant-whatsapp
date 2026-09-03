import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE_NAME as COOKIE_NAME } from "@/lib/auth-constants";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SESSION_SECRET);
}

function ttlSeconds(): number {
  return getEnv().AUTH_SESSION_TTL_DAYS * 24 * 60 * 60;
}

/** Émet un cookie de session signé (JWT HS256, stateless). */
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds())
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure hors développement — couvre staging ET production (le cookie ne
    // part jamais en clair sur un déploiement, quel que soit le NODE_ENV).
    secure: getEnv().APP_ENV !== "development",
    path: "/",
    maxAge: ttlSeconds(),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export type SessionClaims = {
  userId: string;
  /** Date d'émission du jeton, en millisecondes (0 si absente). */
  issuedAtMs: number;
};

/** Cookie présent + signature valide → claims, sinon null. */
export async function readSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string") return null;
    return {
      userId: payload.sub,
      issuedAtMs: typeof payload.iat === "number" ? payload.iat * 1000 : 0,
    };
  } catch {
    return null;
  }
}

/** Raccourci historique. */
export async function readSessionUserId(): Promise<string | null> {
  return (await readSession())?.userId ?? null;
}
