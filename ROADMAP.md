# Allowance — Road to A+ (every category)

Status date: 2026-06-10. Current grades from the last full audit are in
parentheses. Work top-to-bottom inside each phase; phases are ordered by
leverage. Items marked **[you]** need the founder (accounts/purchases);
everything else is buildable in-session.

---

## Phase 0 — Unblockers (15 min, mostly [you])

- [ ] **[you]** `cd proxy && npx wrangler deploy` — ships the multi-provider
      metering fix + new 402 body (already merged, not yet live).
- [ ] **[you]** Buy the domain (`allowance.dev` or alternative). Unlocks: vanity
      API host, branded email, real support inbox, credible launch.
- [ ] **[you]** Set `ALERT_WEBHOOK_URL` secret (Discord/Slack webhook) + deploy.
- [ ] **[you]** UptimeRobot (free): monitor `GET /healthz` on the worker every
      minute → email alert.

## Phase 1 — Ops readiness (C → A+)

- [ ] Status page (BetterStack/Instatus free) wired to the healthz monitor;
      link it in the site footer.
- [x] Worker: alert on elevated error *rate*, not just single errors (count
      errors in KV per 5-min window inside `onError`; webhook when > threshold).
- [x] Worker: upstream timeout (e.g. 60s abort) + clean 504 so a hung provider
      can't pin requests open. Test for it.
- [x] Runbook: `docs/RUNBOOK.md` — what to check when (a) proxy down,
      (b) Supabase down, (c) KV stale, (d) deploy rollback (`wrangler rollback`).
- [ ] Supabase: confirm PITR/backup setting; document restore steps in runbook.
- [x] Log hygiene pass: confirm every log path is metadata-only (grep for
      header/body logging; add a test asserting forward strips `Authorization`).

## Phase 2 — Proxy core (A− → A+)

- [x] Enforce request body size limit (e.g. 10 MB) → 413, with test.
- [x] Per-key *monthly* limit (same KV pattern as daily) — completes the
      limits story (daily ✓, project-monthly ✓, key-monthly ✗).
- [x] Make the negative-key cache TTL + IP limit numbers config vars.
- [x] Decide Pro quota policy: either keep "uncapped" (current, honest) or
      build soft-warning at N req/mo. No silent caps.
- [ ] Restricted Postgres role for the worker (replace service_role): create
      role with EXECUTE on exactly `get_proxy_context`, `debit_wallet`,
      `wallets_needing_low_balance_alert`, `mark_low_balance_alerted`; mint JWT;
      swap secret; verify live, keep old key as rollback. (Needs careful
      live testing — do as its own block.)
- [x] Cleanup migration: drop dead columns (`auto_reload_*`,
      `stripe_payment_method_id`) + drop dead RPCs (`set_auto_reload*`,
      `wallets_needing_auto_reload`, `mark_auto_reload_attempted`,
      `credit_wallet` if unused) in one reviewed SQL block.

## Phase 3 — Testing & CI (B → A+)

- [ ] E2E suite (Playwright): signup (magic link via test inbox) → create
      connection → attach to project → mint key → real proxied call against a
      stub upstream → budget decrements → 402 at cap → revoke → 401.
      Run against a **staging** Supabase project + preview worker.
- [ ] Action-level tests: `createConnection`/`attachService`/`setBudget`
      against a local Supabase (or mocked PostgREST) asserting RLS scoping.
- [x] CI: add `npm run build` for the dashboard job; add Playwright job
      (staging secrets via GitHub environments); branch protection on `main`
      requiring CI green.
- [x] Coverage report in CI (vitest --coverage) with an 80% floor on
      `proxy/src` and `dashboard/lib`.

## Phase 4 — Dashboard & UX (B → A+)

- [x] First-run onboarding: when a user has 0 connections, replace the empty
      dashboard with a 3-step guided card (add connection → create project +
      attach → mint key with copy-paste curl that includes their real key
      prefix + worker URL). This is the activation moment — highest UX leverage.
- [x] Toast system (one tiny component) for success/error instead of inline
      text scattered per form.
- [x] Loading/disabled states pass: every server-action button shows pending
      state consistently (audit all forms).
- [x] Mobile pass: test at 375px; fix the project rows + tables (horizontal
      scroll wrappers), nav wrap.
- [x] Accessibility pass: focus order, aria-labels on icon buttons (copy,
      theme, revoke), prefers-reduced-motion respected (done), color-contrast
      check in light mode.
- [x] Key UX: show full key prefix + name prominently; "last used" column
      (data already in schema: `last_used_at` — needs worker to update it,
      throttled, e.g. only when > 1h stale).
- [x] Analytics: add a requests/day bar toggle (cost vs requests), and a
      30→90 day range once data exists (then update pricing copy to match).

## Phase 5 — Marketing & docs (A− → A+) — mostly needs the domain

- [ ] **[you + me]** Point `api.allowance.dev` at the worker (custom domain in
      Cloudflare) and `allowance.dev` at Vercel; update `PROXY` consts +
      `APP_URL` + metadata. This also unlocks Cloudflare WAF rules (zone).
- [ ] **[you + me]** Verify domain in Resend → branded alert emails to any
      user; create `support@` inbox; put it in Terms/Privacy (replacing the
      GitHub-issues placeholder).
- [x] Docs expansion: error reference table (401/402/404/413/429/5xx with
      exact bodies), per-provider quickstarts (OpenAI/Anthropic/Gemini code
      snippets in JS + Python), limits page (3 caps explained), FAQ.
- [x] OpenGraph/social card + favicon (currently default).
- [ ] Landing: add a real screenshot of the dashboard (social proof section
      placeholder until there are users).

## Phase 6 — Business validation (D → A+) — the one that actually matters

- [x] Draft launch assets: Show HN post, outreach DM, 2-minute onboarding gif.
- [ ] **[you]** Post + DM until 10 real developers have keys.
- [x] Define activation metric (connected real API + >50 proxied calls +
      returned in week 2) and check it weekly against `usage_events`.
- [ ] 5 user calls; log verbatim pain quotes in `docs/VALIDATION.md`.
- [ ] Decision gate: ≥3/10 activated → double down (build Phase 7);
      else reposition before writing more code.

## Phase 7 — Earned features (only after Phase 6 signal)

- [ ] Webhooks (budget-hit / key-revoked / low-budget) with HMAC signatures.
- [ ] Management API (create keys/connections programmatically) — agent story.
- [ ] Team workspaces (Enterprise), key rotation endpoint.
- [ ] Stripe live mode + tax settings; annual plan.
- [ ] Settlement batching via Durable Object (trigger: sustained tens of
      req/s or Supabase write saturation — measure first).

---

### Definition of A+ per category (the bar we're holding)

| Category | A+ means |
|---|---|
| Security | Least-privilege DB role, zero dead grants/columns, RLS + log-hygiene tests, WAF on zone |
| Proxy core | All limits complete + size/timeout guards, every error path tested, config-driven |
| Testing/CI | E2E on staging + coverage floor + protected main |
| UX | A stranger activates unaided in <5 min on mobile or desktop |
| Docs/marketing | Every claim true, every snippet copy-paste-runs, branded domain + email |
| Ops | You know it's down before users do; documented recovery; status page |
| Validation | 10 real users, measured activation, recorded pain quotes, a go/no-go decision |
