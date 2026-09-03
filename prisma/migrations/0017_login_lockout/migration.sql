-- Verrouillage de compte après échecs de connexion répétés (anti-brute-force
-- par compte, complément du rate-limit par IP). Logique : server/auth/lockout.ts.

ALTER TABLE "users" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
