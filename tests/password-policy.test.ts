import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordIssue, MIN_PASSWORD_LENGTH } from "../src/server/auth/password-policy.ts";

test("accepte un mot de passe raisonnable", () => {
  assert.equal(passwordIssue("Riz-2024-Bamako!"), null);
  assert.equal(passwordIssue("j aime le the vert au sucre"), null);
});

test("rejette en dessous de la longueur minimale", () => {
  assert.match(passwordIssue("court12")!, new RegExp(`${MIN_PASSWORD_LENGTH} caractères`));
  assert.equal(passwordIssue("a".repeat(MIN_PASSWORD_LENGTH - 1))?.includes("minimum"), true);
});

test("rejette les mots de passe trop courants", () => {
  assert.match(passwordIssue("password123")!, /courant/i);
  assert.match(passwordIssue("MotDePasse1")!, /courant/i); // insensible à la casse
  assert.match(passwordIssue("feredron123")!, /courant/i);
});

test("rejette un caractère répété ou une suite de touches", () => {
  assert.match(passwordIssue("aaaaaaaaaa")!, /répété/i);
  assert.match(passwordIssue("azertyuiopmnbv")!, /suite/i);
  assert.match(passwordIssue("1234567890abc")!, /suite/i);
});

test("rejette au-delà de la longueur maximale", () => {
  assert.match(passwordIssue("a1B2".repeat(80))!, /trop long/i);
});
