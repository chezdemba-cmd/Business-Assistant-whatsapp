import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests d'INTÉGRATION réinitialisation de mot de passe (§R2).
 *
 *   DATABASE_URL="postgresql://…/djeli_test" RUN_DB_TESTS=1 npm test
 *
 * Couvre : demande → e-mail → reset → session révoquée + verrou effacé ;
 * jeton à usage unique ; jeton expiré refusé ; anti-énumération (e-mail inconnu
 * → succès, aucun jeton créé).
 */

const RUN = process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_TESTS === "true";
const DB_URL = process.env.DATABASE_URL ?? "";
const ENABLED = RUN && /(_test|_shadow|localhost|127\.0\.0\.1)/.test(DB_URL);
const suiteOpts = ENABLED
  ? {}
  : { skip: !RUN ? "RUN_DB_TESTS non défini" : "DATABASE_URL hors base de test" };

type Deps = {
  prisma: import("@prisma/client").PrismaClient;
  requestPasswordReset: typeof import("../src/server/auth/password-reset.ts")["requestPasswordReset"];
  resetPassword: typeof import("../src/server/auth/password-reset.ts")["resetPassword"];
  hashResetToken: typeof import("../src/server/auth/password-reset.ts")["hashResetToken"];
  setEmailProvider: typeof import("../src/server/email/provider.ts")["__setEmailProviderForTests"];
  verifyPassword: typeof import("../src/server/auth/password.ts")["verifyPassword"];
};
let d: Deps;

const TAG = `${Date.now()}`;
const userId = `it-pwr-${TAG}`;
const email = `it-pwr-${TAG}@test.local`;
let lastEmailText = "";

before(async () => {
  if (!ENABLED) return;
  const [{ prisma }, svc, emailProv, pw] = await Promise.all([
    import("../src/server/db/client.ts"),
    import("../src/server/auth/password-reset.ts"),
    import("../src/server/email/provider.ts"),
    import("../src/server/auth/password.ts"),
  ]);
  d = {
    prisma,
    requestPasswordReset: svc.requestPasswordReset,
    resetPassword: svc.resetPassword,
    hashResetToken: svc.hashResetToken,
    setEmailProvider: emailProv.__setEmailProviderForTests,
    verifyPassword: pw.verifyPassword,
  };
  // Provider e-mail capturant : mémorise le corps texte (contient le lien).
  d.setEmailProvider({
    name: "mock",
    async send(m) {
      lastEmailText = m.text;
      return { ok: true };
    },
  });

  await d.prisma.user.create({
    data: {
      id: userId,
      email,
      firstName: "Res",
      lastName: "Et",
      // Ancien hash factice — remplacé par le reset ; jamais vérifié tel quel.
      passwordHash: "$2a$12$0000000000000000000000000000000000000000000000000000",
      failedLoginCount: 4,
    },
  });
});

after(async () => {
  if (!ENABLED || !d?.prisma) return;
  d.setEmailProvider(null);
  await d.prisma.auditLog.deleteMany({ where: { actorUserId: userId } }).catch(() => {});
  await d.prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await d.prisma.$disconnect();
});

function tokenFromEmail(): string {
  const m = lastEmailText.match(/reset-password\/([A-Za-z0-9_-]+)/);
  assert.ok(m, "le lien de réinitialisation doit être présent dans l'e-mail");
  return m![1]!;
}

test("demande → e-mail : un jeton non utilisé est créé", suiteOpts, async () => {
  lastEmailText = "";
  const res = await d.requestPasswordReset({ email, requestIp: "1.2.3.4" });
  assert.deepEqual(res, { requested: true });

  const tokens = await d.prisma.passwordResetToken.findMany({ where: { userId } });
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0]!.usedAt, null);
  // Le hash stocké correspond au jeton du lien ; le clair n'est jamais en base.
  assert.equal(tokens[0]!.tokenHash, d.hashResetToken(tokenFromEmail()));
});

test("reset : mot de passe changé, verrou effacé, jeton consommé, sessions révoquées", suiteOpts, async () => {
  const token = tokenFromEmail();
  const before = await d.prisma.user.findUniqueOrThrow({ where: { id: userId } });

  await d.resetPassword({ token, newPassword: "nouveau-mot-de-passe-123" });

  const user = await d.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.notEqual(user.passwordHash, before.passwordHash);
  assert.equal(await d.verifyPassword("nouveau-mot-de-passe-123", user.passwordHash), true);
  assert.ok(user.passwordChangedAt, "passwordChangedAt posé → sessions révoquées");
  assert.equal(user.failedLoginCount, 0, "verrou de connexion réinitialisé");
  assert.equal(user.lockedUntil, null);

  const tok = await d.prisma.passwordResetToken.findFirst({ where: { userId } });
  assert.ok(tok!.usedAt, "jeton marqué utilisé");

  const audits = await d.prisma.auditLog.count({
    where: { actorUserId: userId, action: "PASSWORD_RESET_COMPLETED" },
  });
  assert.equal(audits, 1);
});

test("jeton à usage unique : le rejouer échoue", suiteOpts, async () => {
  const token = tokenFromEmail();
  await assert.rejects(
    () => d.resetPassword({ token, newPassword: "encore-un-autre-456" }),
    /invalide ou expiré/i,
  );
});

test("jeton expiré refusé", suiteOpts, async () => {
  const plain = `expired-${TAG}-abcdefghijklmnop`;
  await d.prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: d.hashResetToken(plain),
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  await assert.rejects(
    () => d.resetPassword({ token: plain, newPassword: "peu-importe-789012" }),
    /invalide ou expiré/i,
  );
});

test("anti-énumération : e-mail inconnu → succès, aucun jeton créé", suiteOpts, async () => {
  const res = await d.requestPasswordReset({ email: `ghost-${TAG}@nowhere.test` });
  assert.deepEqual(res, { requested: true });
  const count = await d.prisma.passwordResetToken.count({
    where: { user: { email: `ghost-${TAG}@nowhere.test` } },
  });
  assert.equal(count, 0);
});
