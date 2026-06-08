#!/usr/bin/env node
// =============================================================================
// Allowance seed — spin up a fully testable account in one command.
//
// Creates (idempotently) a confirmed test user, funds its wallet, adds an
// httpbin endpoint, and mints a proxy key — then prints the key + a ready
// smoke-test command. So you never click through onboarding to test again.
//
// Requires (set as env vars):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// Optional:
//   SEED_EMAIL (default seed+smoke@allowance.test), SEED_PASSWORD,
//   SEED_AMOUNT (default 50), PROXY_KEY_PREFIX (default alw_live_), WORKER_URL
//
// Run:
//   node scripts/seed.mjs
// =============================================================================

import { createHash, randomBytes } from "node:crypto";

const URL_BASE = need("SUPABASE_URL");
const SERVICE = need("SUPABASE_SERVICE_ROLE_KEY");
const ANON = need("SUPABASE_ANON_KEY");
const EMAIL = process.env.SEED_EMAIL || "seed+smoke@allowance.test";
const PASSWORD = process.env.SEED_PASSWORD || "seed-password-change-me-1!";
const AMOUNT = Number(process.env.SEED_AMOUNT || 50);
const PREFIX = process.env.PROXY_KEY_PREFIX || "alw_live_";
const WORKER_URL = process.env.WORKER_URL || "https://api-wallet-proxy.6rataq.workers.dev";

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

async function api(path, { token, key, body, method = "POST" } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: key ?? SERVICE,
      Authorization: `Bearer ${token ?? SERVICE}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function main() {
  // 1. Create the user (idempotent — ignore "already registered").
  const created = await api("/auth/v1/admin/users", {
    body: { email: EMAIL, password: PASSWORD, email_confirm: true },
  });
  if (created.status >= 400 && created.status !== 422) {
    console.error("create user failed:", created.status, created.json);
    process.exit(1);
  }

  // 2. Sign in to get a user JWT (needed for create_endpoint -> auth.uid()).
  const signin = await api("/auth/v1/token?grant_type=password", {
    key: ANON,
    token: ANON,
    body: { email: EMAIL, password: PASSWORD },
  });
  const accessToken = signin.json?.access_token;
  const userId = signin.json?.user?.id;
  if (!accessToken || !userId) {
    console.error("sign-in failed:", signin.status, signin.json);
    process.exit(1);
  }
  console.log(`User: ${EMAIL} (${userId})`);

  // 3. Fund the wallet (service_role). Unique ref so each run adds.
  const credit = await api("/rest/v1/rpc/credit_wallet", {
    body: {
      p_user_id: userId,
      p_amount: AMOUNT,
      p_type: "topup",
      p_external_ref: `seed-${Date.now()}`,
    },
  });
  if (credit.status >= 400) {
    console.error("credit_wallet failed:", credit.status, credit.json);
    process.exit(1);
  }
  console.log(`Funded: +$${AMOUNT}`);

  // 4. Create an httpbin endpoint (as the user, so create_endpoint owns it).
  const endpoint = await api("/rest/v1/rpc/create_endpoint", {
    key: ANON,
    token: accessToken,
    body: {
      p_name: "Smoke Test (httpbin)",
      p_target_url: "https://httpbin.org",
      p_cost_per_request: 0.01,
      p_auth_headers: { Authorization: "Bearer seed-test-123" },
    },
  });
  const endpointId = endpoint.json;
  if (endpoint.status >= 400 || typeof endpointId !== "string") {
    console.error("create_endpoint failed:", endpoint.status, endpoint.json);
    process.exit(1);
  }
  console.log(`Endpoint: ${endpointId}`);

  // 5. Mint a proxy key (service_role). Hash in node; plaintext shown once.
  const token = randomBytes(24).toString("base64url");
  const key = `${PREFIX}${token}`;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const keyPrefix = key.slice(0, PREFIX.length + 6);
  const issued = await api("/rest/v1/rpc/issue_proxy_key", {
    body: {
      p_user_id: userId,
      p_key_hash: keyHash,
      p_key_prefix: keyPrefix,
      p_endpoint_id: endpointId,
    },
  });
  if (issued.status >= 400) {
    console.error("issue_proxy_key failed:", issued.status, issued.json);
    process.exit(1);
  }

  console.log("\n=== SEED COMPLETE ===");
  console.log(`Proxy key: ${key}`);
  console.log("\nNow smoke-test the full path:");
  console.log(`  WORKER_URL=${WORKER_URL} ALLOWANCE_KEY=${key} node scripts/smoke.mjs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
