# Allowance

An ultra-frictionless **prepaid "API debit card" for AI builders and agents.**
Load a balance, add your backend endpoints (URL + raw auth headers), and get one
proxy URL + one key. Agents route through the edge proxy, which validates the key
and balance at the edge, forwards the request (SSE streaming supported), streams
the response back, and deducts a flat cost per call. Balance hits zero →
**HTTP 402 (x402)**, hard stop.

## Architecture

```
Client / Agent
   │  Authorization: Bearer alw_live_…
   ▼
proxy/  ── Hono on Cloudflare Workers ───────────────────────────┐
   │  SHA-256(key) → KV (encrypted creds + balance snapshot)     │
   │  miss → get_proxy_context RPC → AES-GCM encrypt → cache     │
   │  balance < cost → 402 x402                                  │
   │  forward → stream back (SSE pass-through)                   │
   │  ctx.waitUntil → debit_wallet + Lago + refresh KV           │
   └────────────────────────────────────────────────────────────┘
        │                                   │
        ▼                                   ▼
db/  Supabase (Postgres + Vault)      Lago (metering)
   • RLS deny-by-default                 Stripe (top-ups) ──┐
   • creds encrypted in Vault                               │
   • money + decryption via              dashboard/  Next.js 15 (Vercel)
     service_role SECURITY DEFINER RPCs  • magic-link auth
        ▲                                • add endpoint → Vault
        └──── credit_wallet ◀── Stripe webhook ◀───────────┘
```

## Layout

| Path | What | Stack |
|------|------|-------|
| `db/schema.sql` | One paste-and-run schema (tables, RLS, Vault RPCs) | Supabase / Postgres |
| `proxy/` | Edge proxy: auth, x402, streaming, settlement, rate limit | Hono · Cloudflare Workers |
| `dashboard/` | Auth, add-endpoint, mint-key, Stripe top-ups | Next.js 15 · Tailwind v4 |
| `docs/architecture/` | Request lifecycle sequence diagram | — |

## Quick start (local)

See [DEPLOY.md](DEPLOY.md) for the full runbook. Short version:

1. **DB** — paste `db/schema.sql` into the Supabase SQL Editor, enable the Vault extension.
2. **Proxy** — `cd proxy && npm install && npm test`, then `npm run dev`.
3. **Dashboard** — `cd dashboard && npm install`, fill `.env.local`, `npm run dev`.

## Tests

```bash
cd proxy && npm test     # 23 tests — edge crypto, x402, streaming, settlement, rate limit
```

## Security posture

- Upstream credentials encrypted at rest in **Supabase Vault**; cached at the
  edge only as **AES-256-GCM** ciphertext; decrypted in memory per request.
- Proxy keys stored as **SHA-256 hashes** only; plaintext shown once.
- **RLS deny-by-default**; clients can never write their own balance — all money
  moves through `service_role` `SECURITY DEFINER` RPCs.
- Wallet credited **only** on a signature-verified Stripe webhook; idempotent.
- **Zero-logging**: no headers, bodies, or tokens are ever logged.
