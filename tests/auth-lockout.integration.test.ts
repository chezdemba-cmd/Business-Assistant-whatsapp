import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Test d'INTÉGRATION du verrouillage de compte (§R1) : round-trip en base des
 * champs `failedLoginCount` / `lockedUntil` (migration 0017) via la logique pure
 * de `server/auth/lockout.ts`. Reproduit ce que fait `loginAction` sans dépendre
 * du contexte de requête (`next/headers` / cookies).
 *
 *   DATABASE_URL="postgresql://…/djeli_test" RUN_DB_TESTS=1 npm test
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";
const DB_URL = process.env.DATABASE_URL ?? "";
const ENABLED = RUN && /(_test|_shadow|localhost|127\.0\.0\.1)/.test(DB_URL);
const suiteOpts = ENABLED
  ? {}
  : { skip: !RUN ? "RUN_DB_TESTS non défini" : "DATABASE_URL hors base de test" };

type Deps = {
  prisma: import("@prisma/client").PrismaClient;
  lk: typeof import("../src/server/auth/lockout.ts");
};
let d: Deps;
const TAG = `it-lock-${Date.now()}`;
const userId = `${TAG}-u`;

before(async () => {
  if (!ENABLED) return;
  const [{ prisma }, lk] = await Promise.all([
    import("../src/server/db/client.ts"),
    import("../src/server/auth/lockout.ts"),
  ]);
  d = { prisma, lk };
  await d.prisma.user.create({
    data: { id: userId, email: `${TAG}@test.local`, firstName: "T", lastName: "Est" },
  });
});

after(async () => {
  if (!ENABLED || !d?.prisma) return;
  await d.prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await d.prisma.$disconnect();
});

test("N échecs consécutifs verrouillent le compte en base ; le succès réinitialise", suiteOpts, async () => {
  // Boucle d'échecs comme le fait loginAction.
  for (let i = 0; i < d.lk.LOGIN_LOCK_THRESHOLD; i++) {
    const u = await d.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const next = d.lk.registerFailedAttempt(u);
    await d.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: next.failedLoginCount, lockedUntil: next.lockedUntil },
    });
  }

  const locked = await d.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.ok(locked.lockedUntil, "lockedUntil doit être positionné");
  assert.equal(d.lk.isAccountLocked(locked), true);
  assert.equal(locked.failedLoginCount, 0, "compteur remis à zéro au verrouillage");

  // Simule l'expiration du verrou puis un succès de connexion.
  await d.prisma.user.update({
    where: { id: userId },
    data: { lockedUntil: new Date(Date.now() - 1_000) },
  });
  const expired = await d.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.equal(d.lk.isAccountLocked(expired), false);
  assert.equal(d.lk.needsClearing(expired), true);

  await d.prisma.user.update({ where: { id: userId }, data: d.lk.clearedAttemptState() });
  const cleared = await d.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.equal(cleared.failedLoginCount, 0);
  assert.equal(cleared.lockedUntil, null);
  assert.equal(d.lk.needsClearing(cleared), false);
});
