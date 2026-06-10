# Domain cutover: getallowance.dev

Run top-to-bottom once the zone shows **Active** in Cloudflare. Old URLs keep
working the whole time (workers.dev + vercel.app stay live), so there is no
downtime window.

Final layout:

| Host | Serves | Where |
|---|---|---|
| `getallowance.dev` | marketing site + dashboard | Vercel |
| `www.getallowance.dev` | redirect to apex | Vercel |
| `api.getallowance.dev` | the proxy | Cloudflare Worker custom domain |

## 1. API host (Cloudflare, 2 min)

Workers & Pages → `api-wallet-proxy` → Settings → **Domains & Routes** →
Add → **Custom domain** → `api.getallowance.dev`. Cloudflare creates the DNS
record + certificate automatically. Verify:
`curl https://api.getallowance.dev/healthz` → `{"ok":true}`.

## 2. Site host (Vercel, 5 min)

Vercel → project → Settings → **Domains** → add `getallowance.dev` and
`www.getallowance.dev` (set www to redirect to apex). Vercel shows the records
to create; add them in Cloudflare → DNS with **proxy OFF (grey cloud, DNS
only)** so Vercel's certificate provisioning works:
- apex: `A` → the IP Vercel displays
- `www`: `CNAME` → `cname.vercel-dns.com`

Wait until Vercel shows both domains as valid.

## 3. Code swap (one commit)

- `dashboard/lib/proxy-url.ts` → `https://api.getallowance.dev`
- `dashboard/app/docs/page.tsx` + `dashboard/app/page.tsx` `PROXY` consts → same
- `dashboard/app/layout.tsx` `metadataBase` → `https://getallowance.dev`
- `proxy/wrangler.jsonc` `APP_URL` → `https://getallowance.dev`
- `proxy/src/index.ts` 402 `topUpUrl`/`upgradeUrl` → `https://getallowance.dev/dashboard`
- README/LAUNCH/RUNBOOK links
- Vercel env `NEXT_PUBLIC_APP_URL` → `https://getallowance.dev`, redeploy
- `cd proxy && npx wrangler deploy`

## 4. Auth (Supabase + OAuth, 5 min)

- Supabase → Authentication → URL Configuration:
  Site URL `https://getallowance.dev`; add redirect
  `https://getallowance.dev/auth/confirm` (keep the vercel.app one too).
- GitHub OAuth app + Google OAuth client: update homepage URLs (the callback
  stays `…supabase.co/auth/v1/callback`, unchanged).

## 5. Branded email (Resend, 10 min + DNS wait)

Resend → Domains → Add `getallowance.dev` → it lists 3-4 records (DKIM TXT,
SPF, MX for bounces) → add each in Cloudflare DNS (proxy OFF) → wait for
Verified. Then `npx wrangler secret put RESEND_FROM` is NOT a secret; instead
update `wrangler.jsonc` var `RESEND_FROM` to
`Allowance <alerts@getallowance.dev>` and redeploy. Alerts now reach any user.

## 6. WAF rate limit (now possible, 3 min)

Cloudflare → zone `getallowance.dev` → Security → WAF → Rate limiting rules →
Create: expression `(http.host eq "api.getallowance.dev")`, 600 requests /
1 min per IP → Block for 1 min. Zone-level backstop in front of the in-worker
limiter.

## 7. Monitoring

- UptimeRobot: add monitor `https://api.getallowance.dev/healthz`
  (keep the workers.dev one for a week, then delete).
- Discord webhook test still applies unchanged.

## 8. Smoke test

1. `https://getallowance.dev` loads, sign-in works (OAuth + magic link).
2. Mint a key → **Test it** button → ✓.
3. `curl https://api.getallowance.dev/v1/proxy/<slug>/models` with the key → routed.
4. Old URLs still work (nothing breaks for anything already configured).
