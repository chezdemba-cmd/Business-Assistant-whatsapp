import { test } from "node:test";
import assert from "node:assert/strict";
import { productionGuardIssues } from "../src/lib/env.ts";

/** Objet Env minimal pour les garde-fous (§12, §54). */
function env(over: Record<string, unknown> = {}) {
  return {
    APP_ENV: "production",
    NODE_ENV: "production",
    AI_PROVIDER: "openai-compatible",
    AI_API_KEY: "ai-key",
    AI_ALLOW_MOCK_IN_PROD: "0",
    VOICE_PROVIDER: "openai-compatible",
    VOICE_API_KEY: "voice-key",
    VOICE_ALLOW_MOCK_IN_PROD: "0",
    WHATSAPP_PROVIDER: "meta",
    META_APP_SECRET: "meta-secret",
    META_WEBHOOK_VERIFY_TOKEN: "verify-token",
    WHATSAPP_TOKEN_ENCRYPTION_KEY: "0".repeat(44),
    RATE_LIMIT_STORE: "memory",
    REDIS_URL: undefined,
    ALLOW_DEMO_SEED: "0",
    ...over,
  } as never;
}

test("prod OK : aucun garde-fou déclenché", () => {
  assert.deepEqual(productionGuardIssues(env()), []);
});

test("§12 : AI_PROVIDER=mock en prod sans autorisation → bloqué", () => {
  const issues = productionGuardIssues(env({ AI_PROVIDER: "mock" }));
  assert.equal(issues.length, 1);
  assert.match(issues[0]!, /AI_PROVIDER=mock/);
});

test("§12 : autorisé explicitement → passe", () => {
  assert.deepEqual(
    productionGuardIssues(env({ AI_PROVIDER: "mock", AI_ALLOW_MOCK_IN_PROD: "1" })),
    [],
  );
});

test("§54 : ALLOW_DEMO_SEED=1 en prod → bloqué", () => {
  assert.match(productionGuardIssues(env({ ALLOW_DEMO_SEED: "1" }))[0]!, /seed/i);
});

test("RATE_LIMIT_STORE=redis → bloqué (non implémenté, mono-instance only)", () => {
  assert.match(
    productionGuardIssues(env({ RATE_LIMIT_STORE: "redis" }))[0]!,
    /pas encore implémenté|memory/i,
  );
});

test("§7 : AI_PROVIDER=openai-compatible sans AI_API_KEY → bloqué", () => {
  assert.match(
    productionGuardIssues(env({ AI_API_KEY: undefined }))[0]!,
    /AI_API_KEY/,
  );
});

test("§7 : VOICE_PROVIDER=openai-compatible sans VOICE_API_KEY → bloqué", () => {
  assert.match(
    productionGuardIssues(env({ VOICE_API_KEY: undefined }))[0]!,
    /VOICE_API_KEY/,
  );
});

test("§7 : WHATSAPP_PROVIDER=meta sans secrets Meta → bloqué (3 manques)", () => {
  const issues = productionGuardIssues(
    env({
      META_APP_SECRET: undefined,
      META_WEBHOOK_VERIFY_TOKEN: undefined,
      WHATSAPP_TOKEN_ENCRYPTION_KEY: undefined,
    }),
  );
  assert.equal(issues.length, 3);
  assert.ok(issues.some((i) => /META_APP_SECRET/.test(i)));
  assert.ok(issues.some((i) => /META_WEBHOOK_VERIFY_TOKEN/.test(i)));
  assert.ok(issues.some((i) => /WHATSAPP_TOKEN_ENCRYPTION_KEY/.test(i)));
});

test("hors production : aucun garde-fou", () => {
  assert.deepEqual(
    productionGuardIssues(env({ APP_ENV: "staging", NODE_ENV: "development", AI_PROVIDER: "mock" })),
    [],
  );
});
