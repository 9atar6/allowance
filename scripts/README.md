# Allowance test tooling

Two scripts that keep Allowance testable for its whole life — including after launch. Both are zero-dependency (plain Node 20+, no `npm install`).

## `smoke.mjs` — verify any environment in 5 seconds

Runs the critical-path checks (health, auth rejection, and optionally a real call) against any worker URL. CI-friendly: exits non-zero on failure.

```bash
# Basic checks against the default worker
node scripts/smoke.mjs

# Against staging / a custom URL
WORKER_URL=https://allowance-proxy-staging.you.workers.dev node scripts/smoke.mjs

# Full path, including an authenticated call (use a dedicated test key)
ALLOWANCE_KEY=alw_live_xxx node scripts/smoke.mjs
```

## `seed.mjs` — one-command testable account

Creates a confirmed test user, funds it, adds an httpbin endpoint, and mints a proxy key — then prints the key and a ready smoke command. Idempotent (safe to re-run).

```bash
# PowerShell
$env:SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # service_role (secret)
$env:SUPABASE_ANON_KEY="eyJ..."           # anon (public)
node scripts/seed.mjs
```

Optional env: `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_AMOUNT` (default 50), `PROXY_KEY_PREFIX`, `WORKER_URL`.

## The pattern (why this matters)

After launch, **test on staging, never prod.** Staging keeps using Stripe **test mode** + x402 **Sepolia testnet**; prod uses real money. These scripts run against either, so you can verify a deploy — or health-check prod with a throwaway test key — without manual clicking.
