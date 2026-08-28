import { inspectEnv } from "../src/lib/env.ts";

const report = inspectEnv();

if (report.ok) {
  console.log("✓ Variables d'environnement valides.");
  process.exit(0);
}

console.error("✗ Configuration d'environnement invalide :");
for (const issue of report.issues) {
  console.error(`   - ${issue}`);
}
console.error("\nCopiez .env.example vers .env et complétez les valeurs.");
process.exit(1);
