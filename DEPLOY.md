# Deploy Runbook

Order matters: **Supabase → Proxy (Cloudflare) → Dashboard (Vercel) → Stripe → Auth URLs.**
Do it once for a `dev`/preview environment, then repeat for production with prod keys.

---

## 1. Supabase (database + auth + vault)

1. Create a project at [supabase.com](https://supabase.com). Note the **Project URL**,
   **anon** key, and **service_role** key (Settings → API).
2. **Enable Vault**: Database → Extensions → search `vault` → enable. Also confirm
   `pgcrypto` is enabled.
3. **Apply the schema**: SQL Editor → New query → paste all of [`db/schema.sql`](db/schema.sql) → Run.
4. Verify:
   ```sql
   select tablename from pg_tables where schemaname = 'public' order by tablename;
   -- endpoints, profiles, proxy_keys, usage_events, wallet_transactions, wallets
   ```

> The schema is re-runnable — if a statement trips, fix and re-run the whole file.

---

## 2. Proxy (Cloudflare Workers)

```bash
cd proxy
npm install
npm test                                   # 23 tests should pass

# Create the KV namespace, then paste the printed id(s) into wrangler.jsonc
npx wrangler kv namespace create WALLET_KV
npx wrangler kv namespace create WALLET_KV --preview

# Secrets (never put these in wrangler.jsonc):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # → EDGE_ENCRYPTION_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put EDGE_ENCRYPTION_KEY
npx wrangler secret put ADMIN_PURGE_SECRET  # must equal dashboard PROXY_PURGE_SECRET
npx wrangler secret put LAGO_API_KEY        # optional in phase 1

# Set the non-secret SUPABASE_URL in wrangler.jsonc "vars", then:
npx wrangler deploy
```

Edit `wrangler.jsonc`:
- `kv_namespaces[0].id` / `preview_id` → the ids printed above.
- `vars.SUPABASE_URL` → your project URL.
- The `RATE_LIMITER` binding (100 req / 60s per key) is already configured.

**WAF / zone protection** (dashboard, defense in depth on top of the in-worker
per-key limit): Cloudflare dashboard → Security → WAF → enable managed rules +
an IP-based rate-limiting rule on the proxy route.

Note the deployed Worker URL, e.g. `https://api-wallet-proxy.<acct>.workers.dev`.

---

## 3. Dashboard (Vercel)

```bash
cd dashboard
npm install
npm run build        # sanity check locally
```

Push to a Git repo, import into Vercel, set **root directory = `dashboard`**, and
add env vars (Project → Settings → Environment Variables):

| Var | Value | Exposed to browser? |
|-----|-------|---------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **no** |
| `NEXT_PUBLIC_APP_URL` | your Vercel URL | yes |
| `PROXY_KEY_PREFIX` | `alw_live_` | no |
| `STRIPE_SECRET_KEY` | `sk_…` | **no** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (from step 4) | **no** |
| `PROXY_ADMIN_URL` | deployed worker URL | **no** |
| `PROXY_PURGE_SECRET` | = worker `ADMIN_PURGE_SECRET` | **no** |

Deploy.

---

## 4. Stripe (top-ups)

1. Get `STRIPE_SECRET_KEY` (test mode first) → add to Vercel.
2. Create a webhook endpoint pointing at
   `https://<your-app>/api/stripe/webhook`, subscribe to
   **`checkout.session.completed`**. Copy its signing secret → `STRIPE_WEBHOOK_SECRET`.
3. Local testing:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints whsec_…
   stripe trigger checkout.session.completed
   ```

---

## 4b. Lago (usage metering — optional in Phase 1)

If unset, Lago is skipped everywhere (no-op). To enable:

1. Get `LAGO_API_URL` + `LAGO_API_KEY`. Add them (and `LAGO_PLAN_CODE=api_wallet_usage`)
   to Vercel **and** to the worker (`wrangler secret put LAGO_API_KEY`; `LAGO_API_URL`
   + `LAGO_EVENT_CODE=api_call` are already in `wrangler.jsonc` vars).
2. Create the metric + plan once:
   ```bash
   cd dashboard
   LAGO_API_URL=… LAGO_API_KEY=… node scripts/setup-lago.mjs
   ```
   The metric code (`api_call`) must equal the worker's `LAGO_EVENT_CODE`; the
   plan code must equal `LAGO_PLAN_CODE`.
3. Provisioning is automatic: on a user's first successful Stripe top-up, the
   webhook upserts their Lago customer + subscription (idempotent), so the
   proxy's per-call events attach to it.

---

## 5. Supabase auth redirect URLs

Supabase → Authentication → URL Configuration:
- **Site URL**: your app origin (`https://<your-app>`).
- **Redirect URLs**: add `https://<your-app>/auth/confirm` (and
  `http://localhost:3000/auth/confirm` for local dev).

Otherwise magic links won't resolve.

---

## 6. Smoke test (end to end)

1. Sign in to the dashboard via magic link.
2. Top up (Stripe test card `4242 4242 4242 4242`) → balance updates after the webhook.
3. Add an endpoint (e.g. `https://api.openai.com/v1`, headers `Authorization: Bearer sk-…`).
4. Mint a proxy key (copy it — shown once).
5. Call the proxy:
   ```bash
   curl -N https://<worker-url>/v1/proxy/chat/completions \
     -H "Authorization: Bearer alw_live_…" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"stream":true}'
   ```
6. Drain the balance → expect `HTTP 402` with an x402 body.
