// =============================================================================
// Latency benchmark against the STAGING stack (never production).
//
// Creates a disposable user + connection + key through the same RPCs the
// dashboard uses, measures four paths (sequentially, from this machine):
//   1. /healthz                    — edge round-trip baseline
//   2. /v1/me                      — auth + KV pipeline (cache-hit)
//   3. proxied  GET via staging    — full pipeline + upstream
//   4. direct   GET to upstream    — the same call without Allowance
// then deletes the user (cascade). Proxy overhead = (3) - (4) medians.
//
// Usage:  node proxy/scripts/benchmark.mjs   (reads dashboard/.env.staging)
// =============================================================================

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const STAGING_WORKER = "https://allowance-proxy-staging.6rataq.workers.dev";
const UPSTREAM = "https://postman-echo.com";
const SAMPLES = 30;

const env = {};
for (const line of readFileSync(new URL("../../dashboard/.env.staging", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.+)$/.exec(line);
  if (m) env[m[1]] = m[2].trim();
}
const URL_ = env.STAGING_SUPABASE_URL;
const ANON = env.STAGING_SUPABASE_ANON_KEY;
const SERVICE = env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) throw new Error("fill dashboard/.env.staging first");

const sb = (path, token, init = {}) =>
  fetch(`${URL_}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

async function must(resPromise, what) {
  const res = await resPromise;
  if (!res.ok) throw new Error(`${what}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Setup: disposable user with a working key ────────────────────────────────
const email = `bench-${Date.now()}@e2e.getallowance.dev`;
const password = `Bench!${randomBytes(12).toString("base64url")}`;

const created = await must(
  sb("/auth/v1/admin/users", SERVICE, {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  }),
  "create user",
);
const userId = created.id;
console.log("user:", userId);

try {
  const signin = await must(
    sb("/auth/v1/token?grant_type=password", ANON, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
    "sign in",
  );
  const userToken = signin.access_token;

  await must(
    sb("/rest/v1/rpc/create_project", userToken, {
      method: "POST",
      body: JSON.stringify({ p_name: "bench", p_monthly_budget: null }),
    }),
    "create_project",
  );
  const [project] = await must(
    sb(`/rest/v1/projects?select=id&user_id=eq.${userId}`, userToken),
    "select project",
  );

  await must(
    sb("/rest/v1/rpc/create_endpoint", userToken, {
      method: "POST",
      body: JSON.stringify({
        p_name: "echo",
        p_target_url: UPSTREAM,
        p_cost_per_request: 0.000001,
        p_auth_headers: {},
        p_metering_mode: "flat",
        p_input_token_cost: 0,
        p_output_token_cost: 0,
        p_project_id: null,
        p_slug: null,
      }),
    }),
    "create_endpoint",
  );
  const [endpoint] = await must(
    sb(`/rest/v1/endpoints?select=id&user_id=eq.${userId}`, userToken),
    "select endpoint",
  );

  await must(
    sb("/rest/v1/rpc/attach_service", userToken, {
      method: "POST",
      body: JSON.stringify({
        p_project_id: project.id,
        p_endpoint_id: endpoint.id,
        p_slug: "echo",
      }),
    }),
    "attach_service",
  );

  const token = randomBytes(24).toString("base64url");
  const key = `alw_live_${token}`;
  await must(
    sb("/rest/v1/rpc/issue_proxy_key", SERVICE, {
      method: "POST",
      body: JSON.stringify({
        p_user_id: userId,
        p_key_hash: createHash("sha256").update(key).digest("hex"),
        p_key_prefix: key.slice(0, 15),
        p_project_id: project.id,
      }),
    }),
    "issue key",
  );
  await must(
    sb(`/rest/v1/wallets?user_id=eq.${userId}`, SERVICE, {
      method: "PATCH",
      body: JSON.stringify({ balance: 100 }),
      headers: { Prefer: "return=minimal" },
    }),
    "fund wallet",
  );

  // ── Measure ─────────────────────────────────────────────────────────────────
  const time = async (fn) => {
    const t0 = performance.now();
    const res = await fn();
    await res.arrayBuffer(); // drain
    return performance.now() - t0;
  };
  const stats = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const pick = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return { p50: pick(0.5), p95: pick(0.95) };
  };
  const run = async (label, fn) => {
    for (let i = 0; i < 3; i++) await time(fn); // warm (DNS, TLS, edge cache)
    const samples = [];
    for (let i = 0; i < SAMPLES; i++) samples.push(await time(fn));
    const { p50, p95 } = stats(samples);
    console.log(`${label.padEnd(28)} p50 ${p50.toFixed(0).padStart(5)} ms   p95 ${p95.toFixed(0).padStart(5)} ms`);
    return { p50, p95 };
  };

  const auth = { headers: { Authorization: `Bearer ${key}` } };
  const healthz = await run("healthz (edge RTT)", () => fetch(`${STAGING_WORKER}/healthz`));
  const me = await run("/v1/me (auth pipeline)", () => fetch(`${STAGING_WORKER}/v1/me`, auth));
  const direct = await run("upstream direct", () => fetch(`${UPSTREAM}/get`));
  const proxied = await run("upstream via Allowance", () => fetch(`${STAGING_WORKER}/v1/proxy/echo/get`, auth));

  console.log("\n── Result ──────────────────────────────────────");
  console.log(`proxy overhead (p50): ${(proxied.p50 - direct.p50).toFixed(0)} ms`);
  console.log(`proxy overhead (p95): ${(proxied.p95 - direct.p95).toFixed(0)} ms`);
  console.log(`auth+caps cost beyond raw RTT (p50): ${(me.p50 - healthz.p50).toFixed(0)} ms`);
} finally {
  await sb(`/auth/v1/admin/users/${userId}`, SERVICE, { method: "DELETE" });
  console.log("\ncleaned up:", userId);
}
