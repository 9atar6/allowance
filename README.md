# Allowance

**One key. Every API. A hard cap.**

Allowance is a BYOK spend-control gateway: bring the API keys you already pay
for (OpenAI, Anthropic, anything HTTP), set a **free budget cap**, and route
your traffic through one Allowance key. Every call is metered at the edge,
per-token for the big AI providers and flat-rate for everything else, and the
moment a cap trips, calls stop with **HTTP 402**. Leaked key? Revoke it and it
dies globally within seconds.

Allowance never touches provider billing: your providers charge you directly,
as before. The budget is a guardrail, not a wallet. Revenue comes from the Pro
subscription (no request cap + analytics), never from a markup on your AI.

Built for agents, not just humans: every response carries `x-allowance-*`
spend headers, every 402 is machine-readable with a `retryHint`, a key can
inspect its own budget at `GET /v1/me`, and the [MCP server](mcp/README.md)
puts all of that in your agent's toolbox.

Live: [getallowance.dev](https://getallowance.dev) ·
[Security model](https://getallowance.dev/security) ·
[Docs](https://getallowance.dev/docs) ·
[OpenAPI](https://getallowance.dev/openapi.yaml)

## Architecture

```
Client / Agent
   │  Authorization: Bearer alw_live_…
   ▼
proxy/  ── Hono on Cloudflare Workers ───────────────────────────┐
   │  per-IP throttle → SHA-256(key) → KV (encrypted creds       │
   │  + budget snapshot); miss → get_proxy_context RPC →         │
   │  AES-GCM encrypt → cache (bad keys negative-cached)         │
   │  caps: budget · project/mo · key/day · key/mo → 402         │
   │  guards: 10MB body → 413 · 60s header timeout → 504         │
   │  forward → stream back (SSE pass-through, usage metered)    │
   │  ctx.waitUntil → debit_wallet + refresh KV counters         │
   │  GET /v1/me → key self-inspection (no upstream call)        │
   │  cron */15m → low-budget emails · spend webhooks            │
   │              · monthly allowance refills                    │
   └─────────────────────────────────────────────────────────────┘
        │
        ▼
db/  Supabase (Postgres + Vault)         dashboard/  Next.js 15 (Cloudflare)
   • RLS deny-by-default                   • GitHub/Google OAuth + magic link
   • creds encrypted in Vault              • connections → projects → keys
   • worker runs a restricted role         • rotation · ephemeral keys
     (7 RPCs, nothing else)                • Polar subscription (Pro) ────┐
        ▲                                                                 │
        └──── set_plan ◀── signature-verified Polar webhook ◀────────────┘
```

## Layout

| Path | What | Stack |
|------|------|-------|
| `db/schema.sql` | One idempotent paste-and-run schema (tables, RLS, Vault RPCs) | Supabase / Postgres |
| `db/healthcheck.sql` | Read-only audit: 22 PASS/FAIL checks on the live DB | Supabase / Postgres |
| `proxy/` | Edge proxy: auth, caps, streaming, metering, settlement, alerts | Hono · Cloudflare Workers |
| `dashboard/` | Onboarding, connections/projects/keys, analytics, Pro billing | Next.js 15 · Tailwind v4 |
| `mcp/` | MCP server: agents check their own budget and decode 402s | Model Context Protocol |
| `docs/` | RUNBOOK (ops), E2E (testing), architecture | - |

## Self-hosting

Allowance is MIT-licensed and built to run as your own instance, where every
secret (provider keys, vault, edge encryption key) lives on infrastructure
**you** control and we see nothing. See [SELFHOST.md](SELFHOST.md) for the
10-minute guide (your Supabase + your Cloudflare Worker + a Dockerized
dashboard).

## Quick start (local)

See [DEPLOY.md](DEPLOY.md) for the full runbook. Short version:

1. **DB**: paste `db/schema.sql` into the Supabase SQL Editor (Vault enabled).
2. **Proxy**: `cd proxy && npm install && npm test`, then `npm run dev`.
3. **Dashboard**: `cd dashboard && npm install`, fill `.env.local`, `npm run dev`.

## Tests

```bash
cd proxy && npm test         # 58 unit tests: crypto, routing, caps, streaming, metering
cd dashboard && npm test     # 40 unit tests: validation (SSRF guard), keys, formatting
cd dashboard && npm run e2e  # 36 Playwright tests: public pages (desktop+mobile)
                             # + the full authed journey against the real stack
```

The end-to-end journey creates a disposable user, walks onboarding, mints a
key, makes a real proxied call, verifies the live 402 hard-stop at zero
budget, rotates, revokes, and cleans up. See [docs/E2E.md](docs/E2E.md).

CI runs typecheck + unit tests (with coverage floors) + a production build +
the public-page E2E tier on every push.

## Security posture

Full model with verification links: [getallowance.dev/security](https://getallowance.dev/security).

- Upstream credentials encrypted at rest in **Supabase Vault**; cached at the
  edge only as **AES-256-GCM** ciphertext; decrypted in memory per request.
- Proxy keys stored as **SHA-256 hashes** only; plaintext shown once.
  One-click **rotation** (24h grace) and **ephemeral keys** (1h to 30d).
- **RLS deny-by-default**; budgets move only through `SECURITY DEFINER` RPCs;
  the edge worker holds a **restricted role** that can execute exactly 7 RPCs
  and touch nothing else (not the service_role key).
- **SSRF guard** on every connection and webhook URL (no private/loopback/
  metadata hosts), enforced at entry and re-checked at point of use.
- Pre-auth **per-IP rate limit** + negative-cache for bad keys (DB flood
  protection); per-key limit post-auth.
- **Zero-logging**: no headers, bodies, prompts, or tokens are ever logged.
- Vulnerability reports: see [SECURITY.md](SECURITY.md).
