# Allowance — Operations Runbook

What to check, in order, when something is wrong. Keep this current: every
incident that isn't covered here should add a section.

**Key URLs**

| Thing | Where |
|---|---|
| Worker health | `https://api.getallowance.dev/healthz` (expect `{"ok":true}`) |
| Worker logs (live) | `cd proxy && npx wrangler tail` |
| Worker dashboard | Cloudflare → Workers & Pages → `api-wallet-proxy` (metrics, errors, cron runs) |
| Database | Supabase dashboard → project `izcxmonodmfoebaazxxe` |
| Dashboard hosting | Vercel → `allowance` project (deployments, function logs) |
| CI | GitHub → Actions tab |

---

## 1. "The proxy is down" (healthz failing / users report 5xx)

1. `curl https://api.getallowance.dev/healthz` — if 200, the
   worker itself is fine; go to §2 (likely Supabase) or §5 (one user's config).
2. Check Cloudflare status: https://www.cloudflarestatus.com (Workers/KV).
3. `npx wrangler tail` and send a test request — read the structured log events
   (`unhandled_error`, `upstream_error`, `auth_resolved`).
4. If a bad deploy is suspected: **rollback** —
   `cd proxy && npx wrangler rollback` (or pick a version:
   `npx wrangler deployments list` → `npx wrangler rollback [version-id]`).

## 2. "Supabase is down / slow" (auth works for cached keys, fails for new)

Symptoms: cache-hit traffic keeps flowing (60s KV snapshots), cache-miss
requests 401/500, settlement logs show `settlement_error`.

1. Supabase dashboard → project health; https://status.supabase.com.
2. Nothing to do in the worker — it degrades by design: cached keys keep
   serving, settlement retries are unnecessary (debits are idempotent on
   request_id, but un-settled requests are simply not charged).
3. After recovery: nothing to replay. Spend counters may be slightly under-
   counted for the outage window — acceptable by design (budgets are estimates).

## 3. "Stale KV" (revoked key still working / budget not updating)

- Key revocation: the dashboard calls the worker's `/admin/purge` (instant).
  If that secret is unset/broken, revocation falls back to the KV TTL —
  **≤ 60 s** (`KV_CONTEXT_TTL_SECONDS`). Wait one minute before digging.
- Budget edits propagate the same way: ≤ 60 s.
- To force-purge one key: POST `/admin/purge` with the shared secret and the
  key hash (see dashboard `lib/proxy-admin.ts` for the exact shape).

## 4. Alerts

- **Error burst**: the worker counts unhandled errors per 5-minute window and
  pings `ALERT_WEBHOOK_URL` once when a window crosses 5 errors. If you get
  one: `npx wrangler tail`, find `unhandled_error` events, read the requestId.
- **Uptime**: external monitor on `/healthz` (UptimeRobot). If it fires and
  §1.1 shows 200, the monitor itself may be flaky — check from a second network.
- **Low-budget emails** (user-facing): cron `*/15min`. If users say they get
  none: is `RESEND_API_KEY` set? Is the Resend domain verified (the onboarding
  sender only emails the account owner)? Check cron runs in the CF dashboard.

## 5. "One user's calls fail" (everyone else fine)

Walk their request through the gate order — each has a distinct error body:

| Status | Body `error` | Meaning |
|---|---|---|
| 429 | `rate_limited` | per-IP (pre-auth) or per-key limiter |
| 401 | `missing_api_key` / `invalid_api_key` | bad/revoked key (negative-cached ~60s) |
| 404 | `unknown_service` | project key, slug doesn't match an attached service |
| 503 | `endpoint_unavailable` | single-endpoint key, endpoint disabled |
| 413 | `payload_too_large` | body over 10 MB |
| 402 | `daily_limit_reached` / `monthly_limit_reached` / `project_budget_reached` / x402 body | one of their caps tripped |
| 502 | `upstream_unreachable` | their provider URL is down/wrong |
| 504 | `upstream_timeout` | provider didn't return headers within 60 s |

Most "bugs" are a cap they forgot they set, or a provider key they rotated.

## 6. Deploys

- **Worker**: `cd proxy && npx wrangler deploy`. Verify: healthz 200 + one real
  proxied call. Rollback: `npx wrangler rollback`.
- **Dashboard**: push to `main` → Vercel auto-deploys. Rollback: Vercel →
  Deployments → previous → "Promote to Production".
- **Database**: paste `db/schema.sql` in the Supabase SQL editor (idempotent).
  There is no automated rollback — schema changes are additive by convention;
  destructive changes require a dedicated reviewed migration.

## 7. Backups / data loss

- Supabase: daily backups on the current plan (dashboard → Database → Backups).
  Point-in-time recovery requires a paid add-on — revisit before real scale.
- KV holds only re-derivable caches/counters: safe to lose entirely.
- The plaintext of provider credentials exists ONLY in Supabase Vault. Losing
  the project loses the credentials — users would re-enter them. Nothing else
  stores them.

## 8. Secrets inventory (worker)

`SUPABASE_SERVICE_ROLE_KEY`, `EDGE_ENCRYPTION_KEY`, `ADMIN_PURGE_SECRET`,
`RESEND_API_KEY` (optional), `ALERT_WEBHOOK_URL` (optional).
List: `npx wrangler secret list`. Rotating `EDGE_ENCRYPTION_KEY` is safe at any
time: cached blobs fail decryption and re-warm from the DB automatically.
