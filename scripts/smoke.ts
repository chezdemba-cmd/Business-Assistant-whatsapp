/**
 * Smoke test STAGING (§35, §36).
 *
 *   SMOKE_BASE_URL=https://staging.djeli.app npm run smoke
 *
 * Vérifie, sans navigateur, que l'instance répond correctement :
 *   - /api/health        (200, db:true)
 *   - /api/readiness     (200, checks tous à true)
 *   - /                  (répond, redirige vers /login)
 *   - /login             (200)
 *   - /dashboard         (redirige vers /login quand non authentifié)
 *
 * Le parcours authentifié (catalogue, clients, commandes, /ai) se teste au
 * navigateur — voir docs/TEST-SCENARIOS.md.
 */
const BASE = (process.env.SMOKE_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

async function get(path: string, redirect: "follow" | "manual" = "manual") {
  const res = await fetch(`${BASE}${path}`, { redirect, headers: { "user-agent": "djeli-smoke" } });
  const body = await res.text();
  return { status: res.status, location: res.headers.get("location"), body };
}

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name} — ${detail}`);
}

async function main(): Promise<void> {
  console.log(`Smoke test → ${BASE}\n`);

  try {
    const h = await get("/api/health", "follow");
    const j = JSON.parse(h.body || "{}");
    record("GET /api/health", h.status === 200 && j.db === true, `status=${h.status} db=${j.db} appEnv=${j.appEnv}`);
  } catch (e) {
    record("GET /api/health", false, String(e));
  }

  try {
    const r = await get("/api/readiness", "follow");
    const j = JSON.parse(r.body || "{}");
    const allOk = j.checks && Object.values(j.checks).every(Boolean);
    record("GET /api/readiness", r.status === 200 && !!allOk, `status=${r.status} checks=${JSON.stringify(j.checks)}`);
  } catch (e) {
    record("GET /api/readiness", false, String(e));
  }

  try {
    const root = await get("/");
    record("GET /", root.status >= 200 && root.status < 400, `status=${root.status} → ${root.location ?? "(page)"}`);
  } catch (e) {
    record("GET /", false, String(e));
  }

  try {
    const login = await get("/login", "follow");
    record("GET /login", login.status === 200, `status=${login.status}`);
  } catch (e) {
    record("GET /login", false, String(e));
  }

  try {
    const dash = await get("/dashboard");
    const redirected = dash.status >= 300 && dash.status < 400 && (dash.location ?? "").includes("/login");
    record("GET /dashboard (non authentifié → /login)", redirected, `status=${dash.status} location=${dash.location ?? "-"}`);
  } catch (e) {
    record("GET /dashboard", false, String(e));
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} OK`);
  if (failed.length) {
    console.error(`✗ Échecs : ${failed.map((c) => c.name).join(", ")}`);
    process.exit(1);
  }
  console.log("✓ Smoke test réussi.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
