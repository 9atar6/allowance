# End-to-end tests (Playwright)

Two tiers, one suite (`dashboard/e2e/`):

| Tier | File | Needs | Runs |
| --- | --- | --- | --- |
| 1 — public pages | `public.spec.ts` | nothing secret | locally + CI, desktop + mobile viewports |
| 2 — authed journey | `dashboard.spec.ts` | `SUPABASE_SERVICE_ROLE_KEY` | locally only (self-skips elsewhere) |

Tier 1 covers: every public page renders without uncaught errors (catches
hydration mismatches), landing content and links, the mobile cursor-glow
wash-out regression, the agent docs, and the dashboard auth gate.

Tier 2 is one ordered story against the REAL stack (local production build +
live Supabase + live proxy): disposable user -> onboarding -> no-auth
connection -> project -> attach -> mint key -> real proxied call through
api.getallowance.dev -> /v1/me self-inspection -> budget 0 -> live 402
hard-stop -> rotate -> revoke. The user is created via the admin API with a
password, the @supabase/ssr session cookie is forged directly, and everything
is deleted afterwards (cascade).

## Running locally

```powershell
cd dashboard
npm run build        # the suite runs against a production build
npm run e2e          # both tiers (tier 2 uses .env.local automatically)
npm run e2e:public   # tier 1 only
```

First time: `npx playwright install chromium`.

If this machine's antivirus intercepts TLS (Node says "unable to verify the
first certificate"), export the chain once and point Node at it (see
docs/RUNBOOK.md section 10), then:

```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\\path\\to\\.e2e-ca.pem"
```

## CI

The `e2e` job runs tier 1 on every push (real public Supabase URL + anon key,
which ship in the browser bundle anyway). Tier 2 self-skips because CI has no
service-role key. On failure the Playwright report uploads as an artifact.

## What the suite has already caught

- Onboarding unmounting mid-flow after the first key mint (destroying the
  one-time key display) — fixed with OnboardingGate.
- New accounts starting at $0 budget, making the very first proxied call 402 —
  fixed with a $10 starting cap in handle_new_user.
- Settlement re-puts keeping a stale balance snapshot alive forever under
  steady traffic, letting calls outrun a budget cut — fixed by hard-expiring
  snapshots on their original fetch time.
