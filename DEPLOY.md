# Deploy Runbook

Order matters: **Supabase → Proxy (Cloudflare) → Dashboard (Vercel) → Polar → Auth URLs.**
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
npm test                                   # 51 tests should pass

# Create the KV namespace, then paste the printed id(s) into wrangler.jsonc
npx wrangler kv namespace create WALLET_KV
npx wrangler kv namespace create WALLET_KV --preview

# Secrets (never put these in wrangler.jsonc):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # → EDGE_ENCRYPTION_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put EDGE_ENCRYPTION_KEY
npx wrangler secret put ADMIN_PURGE_SECRET  # must equal dashboard PROXY_PURGE_SECRET
npx wrangler secret put RESEND_API_KEY      # optional: low-budget alert emails
npx wrangler secret put ALERT_WEBHOOK_URL   # optional: Slack/Discord error alerts

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
| `POLAR_ACCESS_TOKEN` | `polar_oat_…` (from step 4) | **no** |
| `POLAR_WEBHOOK_SECRET` | `polar_whs_…` (from step 4) | **no** |
| `POLAR_PRO_PRODUCT_ID` | the $20/mo product id (from step 4) | **no** |
| `PROXY_ADMIN_URL` | deployed worker URL | **no** |
| `PROXY_PURGE_SECRET` | = worker `ADMIN_PURGE_SECRET` | **no** |

Deploy.

---

## 4. Polar (Pro subscription, merchant of record)

Polar is the seller of record: it handles payment processing and taxes, and
pays out to an individual — no registered business required.

1. Create an organization at [polar.sh](https://polar.sh) (sign in with GitHub).
2. **Product**: Products → New → "Allowance Pro", subscription, **$20/month**.
   Copy the product id → `POLAR_PRO_PRODUCT_ID` (Vercel).
3. **Access token**: Settings → Developers → New token (checkouts +
   customer sessions scopes, or all) → `POLAR_ACCESS_TOKEN` (Vercel).
4. **Webhook**: Settings → Webhooks → Add endpoint
   `https://<your-app>/api/polar/webhook`, format **Raw**, subscribe to all
   `subscription.*` events. Copy the secret → `POLAR_WEBHOOK_SECRET` (Vercel).
5. Redeploy the dashboard so the env takes effect.

---

## 5. Supabase auth redirect URLs

Supabase → Authentication → URL Configuration:
- **Site URL**: your app origin (`https://<your-app>`).
- **Redirect URLs**: add `https://<your-app>/auth/confirm` (and
  `http://localhost:3000/auth/confirm` for local dev).

Otherwise magic links won't resolve.

---

## 6. Smoke test (end to end)

1. Sign in (GitHub/Google OAuth or magic link). A fresh account shows the
   guided 3-step onboarding.
2. **Set a budget** on the dashboard (free — it's a cap, not a payment).
3. Add a **connection** (e.g. the OpenAI preset, paste your `sk-…` key),
   create a **project**, attach the connection under a slug, mint a **key**
   (copy it — shown once).
4. Call the proxy through your slug:
   ```bash
   curl -N https://<worker-url>/v1/proxy/<slug>/chat/completions \
     -H "Authorization: Bearer alw_live_…" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"stream":true}'
   ```
5. Watch the budget decrement on the dashboard; set the budget to ~0 →
   expect `HTTP 402` (x402-style body with `budgetRemaining`).
6. Revoke the key → the same call returns `401` within seconds.
7. (Pro) Click Upgrade → Polar checkout → pay → plan flips to Pro after the
   webhook; "Manage billing" opens the Polar customer portal.
