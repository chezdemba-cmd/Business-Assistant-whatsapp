/**
 * Réinitialisation de l'organisation DÉMO (§21).
 *
 *   DEMO_RESET_CONFIRM=DJELI-DEMO npm run demo:reset
 *
 * Sécurités :
 *   - refusé si APP_ENV / NODE_ENV = production
 *   - exige DEMO_RESET_CONFIRM=DJELI-DEMO
 *   - ne supprime QUE l'organisation dont le slug = djeli-demo-commerce ET isDemo = true
 *   - ne touche à AUCUNE autre organisation
 * Puis relance le seed staging.
 */
import { PrismaClient } from "@prisma/client";
import { DEMO_ORG_SLUG, seedStaging } from "../prisma/seed-staging.ts";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") {
    console.error("✗ demo:reset refusé : environnement de production.");
    process.exit(1);
  }
  if (process.env.DEMO_RESET_CONFIRM !== "DJELI-DEMO") {
    console.error("✗ Confirmation manquante. Relancer avec : DEMO_RESET_CONFIRM=DJELI-DEMO npm run demo:reset");
    process.exit(1);
  }

  const org = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
    select: { id: true, name: true, isDemo: true },
  });

  if (org) {
    if (!org.isDemo) {
      console.error(`✗ Abandon : l'organisation « ${org.name} » (${DEMO_ORG_SLUG}) n'est PAS marquée isDemo. Aucune suppression.`);
      process.exit(1);
    }
    await prisma.organization.delete({ where: { id: org.id } });
    console.log(`  Supprimé : ${org.name} (${org.id}) et toutes ses données (cascade).`);
  } else {
    console.log("  Aucune organisation démo existante — création directe.");
  }

  const summary = await seedStaging();
  console.log("✓ Organisation démo réinitialisée.");
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k.padEnd(14)}: ${v}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
