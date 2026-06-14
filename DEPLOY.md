# Deploy Runbook

Order matters: **Supabase → Proxy (Cloudflare) → Dashboard (Cloudflare) → Polar → Auth URLs.**
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
npm test                                   # 72 tests should pass

# Create the KV namespace, then paste the printed id(s) into wrangler.jsonc
npx wrangler kv namespace create WALLET_KV
npx wrangler kv namespace create WALLET_KV --preview

# Secrets (never put these in wrangler.jsonc):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # → EDGE_ENCRYPTION_KEY

# IMPORTANT — the proxy must NOT hold the raw service_role key. Mint a JWT for
# the restricted `proxy_worker` role (it can execute only the granted RPCs and
# touch nothing else), and store THAT as SUPABASE_SERVICE_ROLE_KEY:
#   $env:SUPABASE_JWT_SECRET="<Supabase > Settings > API > JWT (legacy) secret>"
#   node scripts/mint-worker-jwt.mjs        # prints the proxy_worker JWT
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # ← paste the minted JWT, not the raw key
npx wrangler secret put EDGE_ENCRYPTION_KEY
npx wrangler secret put ADMIN_PURGE_SECRET  # must equal dashboard PROXY_PURGE_SECRET
npx wrangler secret put RESEND_API_KEY      # optional: low-budget alert emails
npx wrangler secret put ALERT_WEBHOOK_URL   # optional: Slack/Discord error alerts

# Set the non-secret SUPABASE_URL and SUPABASE_ANON_KEY in wrangler.jsonc "vars"
# (the anon key fills PostgREST's apikey slot; the JWT above does the auth), then:
npx wrangler deploy
```

> Why a JWT and not the service_role key: PostgREST resolves the bearer token's
> `role` claim, so the minted token authenticates as `proxy_worker` — a role
> that can execute only the handful of granted RPCs (all `SECURITY DEFINER`) and
> read/write nothing directly. Using the raw service_role key would give the
> edge an RLS-bypassing admin credential, which the design specifically avoids.

Edit `wrangler.jsonc`:
- `kv_namespaces[0].id` / `preview_id` → the ids printed above.
- `vars.SUPABASE_URL` → your project URL.
- The `RATE_LIMITER` binding (100 req / 60s per key) is already configured.

**WAF / zone protection** (dashboard, defense in depth on top of the in-worker
per-key limit): Cloudflare dashboard → Security → WAF → enable managed rules +
an IP-based rate-limiting rule on the proxy route.

Note the deployed Worker URL, e.g. `https://api-wallet-proxy.<acct>.workers.dev`.

---

## 3. Dashboard (Cloudflare Workers, via OpenNext)

The Next.js dashboard runs on Cloudflare Workers using the
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) adapter — same
account as the proxy, no second vendor. (For a containerized alternative, see
[`SELFHOST.md`](SELFHOST.md); the Dockerfile path is unaffected.)

```bash
cd dashboard
npm install
npm run build                 # local sanity check
npm run cf:build              # OpenNext transform → .open-next/worker.js
```

Config lives in `dashboard/wrangler.jsonc` (`nodejs_compat`, the `ASSETS`
binding, and the custom-domain route) and `dashboard/open-next.config.ts`.

**Public, build-safe values** go in `wrangler.jsonc` `"vars"`
(`PROXY_KEY_PREFIX`, `NEXT_PUBLIC_APP_URL`). `NEXT_PUBLIC_*` are also inlined at
build time, so set `NEXT_PUBLIC_APP_URL` to your real origin before building:

```bash
# PowerShell: $env:NEXT_PUBLIC_APP_URL="https://getallowance.dev"
NEXT_PUBLIC_APP_URL=https://getallowance.dev npm run cf:deploy
```

**Server-only secrets** are set with `wrangler secret put` (never in the repo):

| Secret | Value |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**never** browser-exposed) |
| `POLAR_ACCESS_TOKEN` | `polar_oat_…` (from step 4) |
| `POLAR_WEBHOOK_SECRET` | `polar_whs_…` (from step 4) |
| `POLAR_PRO_PRODUCT_ID` | the $20/mo product id (from step 4) |
| `PROXY_ADMIN_URL` | deployed worker URL (e.g. `https://api.getallowance.dev`) |
| `PROXY_PURGE_SECRET` | = worker `ADMIN_PURGE_SECRET` |

```bash
cd dashboard
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY    # repeat per secret above
```

**Custom domain:** in the Cloudflare dashboard, Workers & Pages →
`allowance-dashboard` → Domains → Add Custom Domain. If the apex already has a
DNS record (e.g. a CNAME from a prior host), delete it first, then add the
domain — Cloudflare creates the proxied record to the worker.

---

## 4. Polar (Pro subscription, merchant of record)

Polar is the seller of record: it handles payment processing and taxes, and
pays out to an individual — no registered business required.

1. Create an organization at [polar.sh](https://polar.sh) (sign in with GitHub).
2. **Product**: Products → New → "Allowance Pro", subscription, **$20/month**.
   Copy the product id → `POLAR_PRO_PRODUCT_ID` (worker secret).
3. **Access token**: Settings → Developers → New token (checkouts +
   customer sessions scopes, or all) → `POLAR_ACCESS_TOKEN` (worker secret).
4. **Webhook**: Settings → Webhooks → Add endpoint
   `https://<your-app>/api/polar/webhook`, format **Raw**, subscribe to all
   `subscription.*` events. Copy the secret → `POLAR_WEBHOOK_SECRET` (worker secret).
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
