import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReminderMessage } from "../src/server/finance/reminder-template.ts";

test("message de relance : prénom, référence, solde, échéance", () => {
  const msg = buildReminderMessage({
    customerName: "Aminata Sanogo",
    organizationName: "Djeli Commerce Demo",
    orderReference: "CMD-0007",
    balanceDue: 89000,
    currency: "XOF",
    dueDate: new Date("2026-08-15T00:00:00Z"),
  });
  assert.match(msg, /Aminata/);
  assert.match(msg, /CMD-0007/);
  assert.match(msg, /89 000 FCFA/);
  assert.match(msg, /15\/08\/2026/);
  assert.match(msg, /Djeli Commerce Demo/);
});

test("déterministe : mêmes entrées → même sortie", () => {
  const ctx = {
    customerName: "Sekou",
    organizationName: "ACME",
    balanceDue: 12000,
    currency: "XOF",
  };
  assert.equal(buildReminderMessage(ctx), buildReminderMessage(ctx));
});

test("sans référence ni échéance : message toujours cohérent", () => {
  const msg = buildReminderMessage({
    customerName: "Boubacar Cissé",
    organizationName: "ACME",
    balanceDue: 5000,
    currency: "XOF",
  });
  assert.match(msg, /Boubacar/);
  assert.match(msg, /5 000 FCFA/);
  assert.doesNotMatch(msg, /commande/);
  assert.doesNotMatch(msg, /échéance/i);
});
