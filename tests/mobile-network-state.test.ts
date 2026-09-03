import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialNetState,
  netReducer,
  netBanner,
} from "../src/lib/network-state.ts";

test("§30 : online → offline → reconnected → online", () => {
  let s = initialNetState;
  assert.equal(netBanner(s), null);

  s = netReducer(s, "OFFLINE");
  assert.equal(s.phase, "offline");
  assert.equal(netBanner(s)?.tone, "error");

  s = netReducer(s, "ONLINE");
  assert.equal(s.phase, "reconnected");
  assert.equal(netBanner(s)?.tone, "ok");

  s = netReducer(s, "DISMISS");
  assert.equal(s.phase, "online");
  assert.equal(netBanner(s), null);
});

test("ONLINE sans OFFLINE préalable ne montre pas « rétablie »", () => {
  const s = netReducer(initialNetState, "ONLINE");
  assert.equal(s.phase, "online");
  assert.equal(netBanner(s), null);
});

test("DISMISS n'a d'effet que sur l'état « reconnected »", () => {
  const off = netReducer(initialNetState, "OFFLINE");
  assert.deepEqual(netReducer(off, "DISMISS"), off);
});
