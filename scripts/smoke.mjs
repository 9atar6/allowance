#!/usr/bin/env node
// =============================================================================
// Allowance smoke test — verify a deployed (or local) worker is healthy.
//
// Runs the critical-path checks we used to do by hand, as ONE command. Safe to
// run against any environment, anytime — including a prod health-check with a
// dedicated test key. Exits non-zero if anything fails (CI-friendly).
//
// Usage:
//   node scripts/smoke.mjs
//   WORKER_URL=https://staging-... node scripts/smoke.mjs
//   ALLOWANCE_KEY=alw_live_... node scripts/smoke.mjs    # also runs an auth'd call
// =============================================================================

const WORKER_URL =
  process.env.WORKER_URL || "https://api-wallet-proxy.6rataq.workers.dev";
const KEY = process.env.ALLOWANCE_KEY;
const PROXY_PATH = process.env.PROXY_PATH || "/v1/proxy/post";

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${name} ${detail}`);
    failed++;
  }
}

async function main() {
  console.log(`Smoke testing ${WORKER_URL}\n`);

  // 1. Liveness.
  try {
    const r = await fetch(`${WORKER_URL}/healthz`);
    const j = await r.json().catch(() => ({}));
    check("GET /healthz returns {ok:true}", r.status === 200 && j.ok === true, `(got ${r.status})`);
  } catch (e) {
    check("GET /healthz reachable", false, e.message);
  }

  // 2. Missing key is rejected.
  try {
    const r = await fetch(`${WORKER_URL}${PROXY_PATH}`, { method: "POST" });
    check("proxy without key -> 401", r.status === 401, `(got ${r.status})`);
  } catch (e) {
    check("proxy without key reachable", false, e.message);
  }

  // 3. Invalid key is rejected.
  try {
    const r = await fetch(`${WORKER_URL}${PROXY_PATH}`, {
      method: "POST",
      headers: { Authorization: "Bearer alw_live_definitely_invalid_key" },
    });
    check("proxy with bad key -> 401", r.status === 401, `(got ${r.status})`);
  } catch (e) {
    check("proxy with bad key reachable", false, e.message);
  }

  // 4. Optional: a real key authenticates (200 = charged, 402 = empty balance).
  if (KEY) {
    try {
      const r = await fetch(`${WORKER_URL}${PROXY_PATH}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ smoke: true }),
      });
      check("proxy with real key authenticates", [200, 402].includes(r.status), `(got ${r.status})`);
      if (r.status === 200) console.log("        full path works (call forwarded + charged)");
      if (r.status === 402) console.log("        key valid; balance is empty (x402)");
      if (r.status === 503) console.log("        key valid; endpoint is disabled");
    } catch (e) {
      check("proxy with real key reachable", false, e.message);
    }
  } else {
    console.log("  SKIP  authenticated call (set ALLOWANCE_KEY to enable)");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
