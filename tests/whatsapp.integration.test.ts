import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests d'INTÉGRATION WhatsApp entrant (§49-§52). Propriétés critiques :
 *  - le tenant vient TOUJOURS du Phone Number ID destinataire (jamais du client) ;
 *  - idempotence : rejouer le même message → 1 seule ligne Message ;
 *  - Phone Number ID inconnu → aucune donnée créée.
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
  parse: typeof import("../src/server/whatsapp/webhook-parser.ts")["parseWhatsAppWebhook"];
  process: typeof import("../src/server/whatsapp/inbound-service.ts")["processWhatsAppWebhook"];
};
let d: Deps;

const TAG = `it-wa-${Date.now()}`;
const A = { user: `${TAG}-ua`, org: `${TAG}-oa`, pnid: `PNID_A_${TAG}` };
const B = { user: `${TAG}-ub`, org: `${TAG}-ob`, pnid: `PNID_B_${TAG}` };
const SENDER = "22378441209";

function textPayload(phoneNumberId: string, wamid: string, body: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "22376000000", phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: "Aminata" }, wa_id: SENDER }],
              messages: [
                { from: SENDER, id: wamid, timestamp: "1756382400", type: "text", text: { body } },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function makeOrgWithConnection(o: typeof A) {
  await d.prisma.user.create({
    data: { id: o.user, email: `${o.user}@test.local`, firstName: "T", lastName: "Est" },
  });
  await d.prisma.organization.create({
    data: {
      id: o.org,
      name: `WA Org ${o.org}`,
      slug: o.org,
      currency: "XOF",
      ownerUserId: o.user,
      members: { create: { userId: o.user, role: "OWNER", status: "ACTIVE" } },
      whatsappConnections: { create: { phoneNumberId: o.pnid, status: "CONNECTED" } },
    },
  });
}

before(async () => {
  if (!ENABLED) return;
  const [{ prisma }, parser, inbound] = await Promise.all([
    import("../src/server/db/client.ts"),
    import("../src/server/whatsapp/webhook-parser.ts"),
    import("../src/server/whatsapp/inbound-service.ts"),
  ]);
  d = { prisma, parse: parser.parseWhatsAppWebhook, process: inbound.processWhatsAppWebhook };
  await makeOrgWithConnection(A);
  await makeOrgWithConnection(B);
});

after(async () => {
  if (!ENABLED || !d?.prisma) return;
  for (const o of [A, B]) {
    await d.prisma.organization.delete({ where: { id: o.org } }).catch(() => {});
    await d.prisma.user.delete({ where: { id: o.user } }).catch(() => {});
  }
  await d.prisma.$disconnect();
});

test("routage tenant : le message atterrit dans l'org du Phone Number ID, pas ailleurs", suiteOpts, async () => {
  const res = await d.process(d.parse(textPayload(A.pnid, `wamid.${TAG}.1`, "Bonjour")));
  assert.equal(res.ingested, 1);
  assert.equal(res.skippedUnknownConnection, 0);

  const msgA = await d.prisma.message.count({ where: { organizationId: A.org } });
  const msgB = await d.prisma.message.count({ where: { organizationId: B.org } });
  assert.equal(msgA, 1, "1 message dans l'org A");
  assert.equal(msgB, 0, "0 message dans l'org B (aucune fuite inter-tenant)");

  const custA = await d.prisma.customer.findFirst({
    where: { organizationId: A.org, source: "WHATSAPP" },
    select: { phone: true },
  });
  assert.ok(custA, "client créé dans l'org A depuis WhatsApp");
  assert.equal(await d.prisma.customer.count({ where: { organizationId: B.org } }), 0);
  assert.equal(await d.prisma.conversation.count({ where: { organizationId: B.org } }), 0);
});

test("idempotence : rejouer le même message → deduped, toujours 1 ligne", suiteOpts, async () => {
  const payload = textPayload(A.pnid, `wamid.${TAG}.dup`, "Encore");
  const r1 = await d.process(d.parse(payload));
  const r2 = await d.process(d.parse(payload));
  assert.equal(r1.ingested, 1);
  assert.equal(r2.ingested, 0);
  assert.equal(r2.deduped, 1);

  const count = await d.prisma.message.count({
    where: { organizationId: A.org, externalMessageId: `wamid.${TAG}.dup` },
  });
  assert.equal(count, 1);
});

test("Phone Number ID inconnu → skipped, aucune donnée créée", suiteOpts, async () => {
  const before = await d.prisma.message.count();
  const res = await d.process(d.parse(textPayload(`PNID_UNKNOWN_${TAG}`, `wamid.${TAG}.x`, "Perdu")));
  assert.equal(res.skippedUnknownConnection, 1);
  assert.equal(res.ingested, 0);
  assert.equal(await d.prisma.message.count(), before, "aucun message créé");
});
