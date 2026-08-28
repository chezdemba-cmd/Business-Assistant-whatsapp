import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveTextOf } from "../src/server/voice/effective-text.ts";

test("§48 correction humaine : effectiveText = correctedText", () => {
  assert.equal(
    effectiveTextOf({
      originalText: "six saques sucre",
      correctedText: "six sacs de sucre",
    }),
    "six sacs de sucre",
  );
});

test("sans correction : effectiveText = originalText", () => {
  assert.equal(
    effectiveTextOf({ originalText: "je veux du lait", correctedText: null }),
    "je veux du lait",
  );
  assert.equal(
    effectiveTextOf({ originalText: "je veux du lait", correctedText: "" }),
    "je veux du lait",
  );
  assert.equal(
    effectiveTextOf({ originalText: "je veux du lait", correctedText: undefined }),
    "je veux du lait",
  );
});
