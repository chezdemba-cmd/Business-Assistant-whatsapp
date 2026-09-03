import { test } from "node:test";
import assert from "node:assert/strict";
import { productionGuardIssues } from "../src/lib/env.ts";

/** Objet Env minimal pour les garde-fous (§12, §54). */
function env(over: Record<string, unknown> = {}) {
  return {
    APP_ENV: "production",
    NODE_ENV: "production",
    AI_PROVIDER: "openai-compatible",
    AI_API_KEY: "sk-test",
    AI_ALLOW_MOCK_IN_PROD: "0",
    VOICE_PROVIDER: "openai-compatible",
    VOICE_API_KEY: "sk-test",
    VOICE_ALLOW_MOCK_IN_PROD: "0",
    WHATSAPP_PROVIDER: "meta",
    WHATSAPP_TOKEN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
    META_APP_SECRET: "meta_secret",
    META_WEBHOOK_VERIFY_TOKEN: "verify_token",
    DEPLOYMENT_TOPOLOGY: "single",
    RATE_LIMIT_STORE: "memory",
    REDIS_URL: undefined,
    ALLOW_DEMO_SEED: "0",
    EMAIL_PROVIDER: "resend",
    EMAIL_API_KEY: "re_xxx",
    EMAIL_ALLOW_MOCK_IN_PROD: "0",
    ...over,
  } as never;
}

test("prod OK : aucun garde-fou déclenché", () => {
  assert.deepEqual(productionGuardIssues(env()), []);
});

test("AI_PROVIDER=openai-compatible sans AI_API_KEY → bloqué", () => {
  assert.match(
    productionGuardIssues(env({ AI_API_KEY: undefined }))[0]!,
    /AI_API_KEY/,
  );
});

test("VOICE_PROVIDER=openai-compatible sans VOICE_API_KEY → bloqué", () => {
  assert.match(
    productionGuardIssues(env({ VOICE_API_KEY: undefined }))[0]!,
    /VOICE_API_KEY/,
  );
});

test("WHATSAPP_PROVIDER=meta sans clés de prod → bloqué", () => {
  const issues = productionGuardIssues(
    env({
      WHATSAPP_TOKEN_ENCRYPTION_KEY: undefined,
      META_APP_SECRET: undefined,
      META_WEBHOOK_VERIFY_TOKEN: undefined,
    }),
  );
  assert.equal(issues.length, 3);
  assert.match(issues[0]!, /WHATSAPP_TOKEN_ENCRYPTION_KEY/);
  assert.match(issues[1]!, /META_APP_SECRET/);
  assert.match(issues[2]!, /META_WEBHOOK_VERIFY_TOKEN/);
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

test("RATE_LIMIT_STORE=redis en prod → bloqué (adaptateur non implémenté)", () => {
  assert.match(productionGuardIssues(env({ RATE_LIMIT_STORE: "redis" }))[0]!, /redis/i);
  // Même avec REDIS_URL : toujours bloqué tant que l'adaptateur n'existe pas.
  assert.equal(
    productionGuardIssues(env({ RATE_LIMIT_STORE: "redis", REDIS_URL: "redis://x:6379" })).length,
    1,
  );
});

test("DEPLOYMENT_TOPOLOGY=multi + rate-limit mémoire → bloqué", () => {
  assert.match(
    productionGuardIssues(env({ DEPLOYMENT_TOPOLOGY: "multi" }))[0]!,
    /multi.*rate-limit partagé/i,
  );
  // multi + redis : ce garde-fou-ci ne se déclenche pas (l'autre, sur l'adaptateur, oui).
  const issues = productionGuardIssues(env({ DEPLOYMENT_TOPOLOGY: "multi", RATE_LIMIT_STORE: "redis" }));
  assert.doesNotMatch(issues.join(" "), /exige un rate-limit partagé/i);
});

test("EMAIL_PROVIDER=mock en prod sans autorisation → bloqué", () => {
  assert.match(
    productionGuardIssues(env({ EMAIL_PROVIDER: "mock" }))[0]!,
    /EMAIL_PROVIDER=mock/,
  );
  assert.deepEqual(
    productionGuardIssues(env({ EMAIL_PROVIDER: "mock", EMAIL_ALLOW_MOCK_IN_PROD: "1" })),
    [],
  );
});

test("EMAIL_PROVIDER=resend sans EMAIL_API_KEY → bloqué", () => {
  assert.match(
    productionGuardIssues(env({ EMAIL_API_KEY: undefined }))[0]!,
    /EMAIL_API_KEY/,
  );
});

test("hors production : aucun garde-fou", () => {
  assert.deepEqual(
    productionGuardIssues(env({ APP_ENV: "staging", NODE_ENV: "development", AI_PROVIDER: "mock" })),
    [],
  );
});
