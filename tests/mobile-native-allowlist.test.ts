import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyNavigation,
  isWebViewAllowed,
} from "../src/lib/native-allowlist.ts";

const APP = ["https://app.djeli.io", "https://staging.djeli.app"];
const c = (t: string) => classifyNavigation(t, { appOrigins: APP });

test("§83 : l'origine de l'app est autorisée DANS la WebView", () => {
  assert.equal(c("https://app.djeli.io/dashboard"), "webview");
  assert.equal(c("https://staging.djeli.app/orders/1?x=2"), "webview");
  assert.equal(c("about:blank"), "webview");
  assert.equal(c("capacitor://localhost/index.html"), "webview");
});

test("§82 : toute autre origine http(s) est BLOQUÉE dans la WebView", () => {
  assert.equal(c("https://evil.example/login"), "block");
  assert.equal(c("http://app.djeli.io/x"), "block"); // schéma différent de l'allowlist
  assert.equal(isWebViewAllowed("https://google.com", APP), false);
});

test("schémas système → navigateur / app système, jamais la WebView", () => {
  assert.equal(c("tel:+223900000000"), "system-browser");
  assert.equal(c("mailto:a@b.co"), "system-browser");
  assert.equal(c("sms:+22390"), "system-browser");
});

test("liens WhatsApp / Maps connus → navigateur système", () => {
  assert.equal(c("https://wa.me/22390000000"), "system-browser");
  assert.equal(c("https://api.whatsapp.com/send?phone=223"), "system-browser");
  assert.equal(c("https://maps.google.com/?q=Bamako"), "system-browser");
  assert.equal(c("https://www.google.com/maps/search/?q=Bamako"), "system-browser");
  assert.equal(c("https://www.google.com/search?q=bamako"), "block"); // google non-maps
});

test("entrées invalides → block", () => {
  assert.equal(c(""), "block");
  assert.equal(c("not a url"), "block");
  assert.equal(c("ftp://x/y"), "block");
  assert.equal(c("javascript:alert(1)"), "block");
});
