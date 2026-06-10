# Allowance

**One key. Every API. A hard cap.**

Allowance is a BYOK spend-control gateway: bring the API keys you already pay
for (OpenAI, Anthropic, anything HTTP), set a **free budget cap**, and route
your traffic through one Allowance key. Every call is metered at the edge —
per-token for the big AI providers, flat-rate for everything else — and the
moment a cap trips, calls stop with **HTTP 402**. Leaked key? Revoke it and it
dies globally within seconds.

Allowance never touches provider billing: your providers charge you directly,
as before. The budget is a guardrail, not a wallet. Revenue comes from the Pro
subscription (no request cap + analytics), never from a markup on your AI.

Live: [getallowance.dev](https://getallowance.dev)

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
   │  cron */15m → low-budget alert emails (Resend)              │
   └─────────────────────────────────────────────────────────────┘
        │
        ▼
db/  Supabase (Postgres + Vault)         dashboard/  Next.js 15 (Vercel)
   • RLS deny-by-default                   • GitHub/Google OAuth + magic link
   • creds encrypted in Vault              • connections → projects → keys
   • budget via SECURITY DEFINER RPCs      • Stripe subscription (Pro) ──┐
        ▲                                                                │
        └──── set_plan ◀── signature-verified Stripe webhook ◀──────────┘
```

## Layout

| Path | What | Stack |
|------|------|-------|
| `db/schema.sql` | One idempotent paste-and-run schema (tables, RLS, Vault RPCs) | Supabase / Postgres |
| `db/migrations/` | One-shot destructive migrations (run once, in order) | — |
| `proxy/` | Edge proxy: auth, caps, streaming, metering, settlement, alerts | Hono · Cloudflare Workers |
| `dashboard/` | Onboarding, connections/projects/keys, analytics, Pro billing | Next.js 15 · Tailwind v4 |
| `docs/` | RUNBOOK (ops), LAUNCH + VALIDATION (go-to-market), architecture | — |

## Quick start (local)

See [DEPLOY.md](DEPLOY.md) for the full runbook. Short version:

1. **DB** — paste `db/schema.sql` into the Supabase SQL Editor (Vault enabled).
2. **Proxy** — `cd proxy && npm install && npm test`, then `npm run dev`.
3. **Dashboard** — `cd dashboard && npm install`, fill `.env.local`, `npm run dev`.

## Tests

```bash
cd proxy && npm test        # 51 tests — crypto, routing, caps, streaming, metering
cd dashboard && npm test    # 37 tests — validation (SSRF guard), keys, formatting
```

CI runs typecheck + tests (with coverage floors) + a production build on every
push.

## Security posture

- Upstream credentials encrypted at rest in **Supabase Vault**; cached at the
  edge only as **AES-256-GCM** ciphertext; decrypted in memory per request.
- Proxy keys stored as **SHA-256 hashes** only; plaintext shown once.
- **RLS deny-by-default**; budgets move only through `SECURITY DEFINER` RPCs.
- **SSRF guard** on every connection URL (no private/loopback/metadata hosts).
- Pre-auth **per-IP rate limit** + negative-cache for bad keys (DB flood
  protection); per-key limit post-auth.
- **Zero-logging**: no headers, bodies, prompts, or tokens are ever logged.
