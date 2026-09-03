import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests d'INTÉGRATION Djeli Voice — cycle de correction humaine d'une
 * transcription (§14, §34, §48-§52). Le pipeline de transcription lui-même
 * dépend d'un téléchargement média Meta (réseau) ; on couvre ici la partie
 * métier pure-base : correction, blocage de retranscription, périmètre tenant.
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
  correct: typeof import("../src/server/voice/transcription-service.ts")["correctTranscription"];
  retranscribe: typeof import("../src/server/voice/transcription-service.ts")["retranscribeMessage"];
};
let d: Deps;

const TAG = `it-voice-${Date.now()}`;
const ids = {
  user: `${TAG}-u`,
  org: `${TAG}-o`,
  otherOrg: `${TAG}-o2`,
  otherUser: `${TAG}-u2`,
  conn: `${TAG}-cn`,
  conv: `${TAG}-cv`,
  msg: `${TAG}-m`,
};

before(async () => {
  if (!ENABLED) return;
  const [{ prisma }, svc] = await Promise.all([
    import("../src/server/db/client.ts"),
    import("../src/server/voice/transcription-service.ts"),
  ]);
  d = { prisma, correct: svc.correctTranscription, retranscribe: svc.retranscribeMessage };

  await d.prisma.user.create({
    data: { id: ids.user, email: `${TAG}@test.local`, firstName: "T", lastName: "Est" },
  });
  for (const [oid, name] of [[ids.org, "Voice Org"], [ids.otherOrg, "Autre Org"]] as const) {
    await d.prisma.organization.create({
      data: { id: oid, name, slug: oid, currency: "XOF", ownerUserId: ids.user },
    });
  }
  await d.prisma.organizationMember.create({
    data: { organizationId: ids.org, userId: ids.user, role: "OWNER", status: "ACTIVE" },
  });
  await d.prisma.whatsAppConnection.create({
    data: { id: ids.conn, organizationId: ids.org, phoneNumberId: `PNID_${TAG}`, status: "CONNECTED" },
  });
  await d.prisma.conversation.create({
    data: {
      id: ids.conv,
      organizationId: ids.org,
      whatsappConnectionId: ids.conn,
      externalWaId: "22378441209",
      mode: "HUMAN",
    },
  });
  await d.prisma.message.create({
    data: {
      id: ids.msg,
      organizationId: ids.org,
      conversationId: ids.conv,
      whatsappConnectionId: ids.conn,
      externalMessageId: `wamid.${TAG}`,
      direction: "INBOUND",
      type: "AUDIO",
      status: "DELIVERED",
      mediaId: "MEDIA_123",
      mediaMimeType: "audio/ogg",
    },
  });
  await d.prisma.voiceTranscription.create({
    data: {
      organizationId: ids.org,
      messageId: ids.msg,
      conversationId: ids.conv,
      provider: "mock",
      model: "whisper-1",
      status: "COMPLETED",
      originalText: "6 sac de sikr",
      effectiveText: "6 sac de sikr",
      detectedLanguage: "MIXED",
    },
  });
});

after(async () => {
  if (!ENABLED || !d?.prisma) return;
  await d.prisma.auditLog.deleteMany({ where: { actorUserId: ids.user } }).catch(() => {});
  for (const oid of [ids.org, ids.otherOrg]) {
    await d.prisma.organization.delete({ where: { id: oid } }).catch(() => {});
  }
  await d.prisma.user.delete({ where: { id: ids.user } }).catch(() => {});
  await d.prisma.$disconnect();
});

test("correction humaine : effectiveText = correction, originalText inchangé, statut CORRECTED", suiteOpts, async () => {
  const res = await d.correct({
    organizationId: ids.org,
    messageId: ids.msg,
    correctedText: "  6 sacs de sucre  ",
    actorUserId: ids.user,
  });
  assert.equal(res.effectiveText, "6 sacs de sucre");

  const t = await d.prisma.voiceTranscription.findUniqueOrThrow({ where: { messageId: ids.msg } });
  assert.equal(t.status, "CORRECTED");
  assert.equal(t.effectiveText, "6 sacs de sucre");
  assert.equal(t.correctedText, "6 sacs de sucre");
  assert.equal(t.originalText, "6 sac de sikr", "§14 : l'original n'est jamais écrasé");
  assert.equal(t.correctedByUserId, ids.user);
  assert.ok(t.correctedAt);

  const audit = await d.prisma.auditLog.count({
    where: { action: "VOICE_TRANSCRIPTION_CORRECTED", organizationId: ids.org },
  });
  assert.equal(audit, 1);
});

test("retranscription bloquée après une correction manuelle", suiteOpts, async () => {
  await assert.rejects(
    () => d.retranscribe({ organizationId: ids.org, messageId: ids.msg, actorUserId: ids.user }),
    /corrigée à la main|bloquée/i,
  );
});

test("périmètre tenant : corriger via une autre organisation → introuvable", suiteOpts, async () => {
  await assert.rejects(
    () =>
      d.correct({
        organizationId: ids.otherOrg,
        messageId: ids.msg,
        correctedText: "tentative",
        actorUserId: ids.user,
      }),
    /Aucune transcription/i,
  );
});

test("correction vide refusée", suiteOpts, async () => {
  await assert.rejects(
    () =>
      d.correct({
        organizationId: ids.org,
        messageId: ids.msg,
        correctedText: "   ",
        actorUserId: ids.user,
      }),
    /vide/i,
  );
});
