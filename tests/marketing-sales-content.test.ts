import test from "node:test";
import assert from "node:assert/strict";
import { renderCampaignMessage, salesCampaignMessage } from "../src/server/marketing/content.ts";

test("salesCampaignMessage reste factuel et affiche FCFA", () => {
  const message = salesCampaignMessage({
    organizationName: "Boutique Awa",
    productName: "Ensemble Bazin",
    unitPrice: 25000,
    currency: "XOF",
    available: 20,
  });

  assert.match(message, /Ensemble Bazin/);
  assert.match(message, /25[\s ]000 FCFA/);
  assert.match(message, /20 article\(s\) disponible\(s\)/);
  assert.match(renderCampaignMessage(message, "Mariam"), /^Bonjour Mariam,/);
  assert.doesNotMatch(message, /promotion|réduction|%/i);
});
