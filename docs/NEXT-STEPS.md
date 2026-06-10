# What's left, step by step

Everything infrastructure-related is DONE (domain, API host, WAF, monitoring,
status page, branded email, alerts, CI). This file is the remainder, in order.
Each step says how long it takes and exactly what to click.

---

## Step 1. Smoke test the new domain (2 min, do first)

1. Open https://getallowance.dev (check the logo, cursor light, click effect).
2. Sign in with GitHub or Google.
3. Dashboard: mint a key in your Test project.
4. Click **Test it** under the new key. Expect: "✓ ... your key works."
5. Optional: set your low-budget alert just above your current budget, wait
   ~15 min, and confirm the email arrives from **alerts@getallowance.dev**.

If anything fails, note the exact error and bring it to the next session.

---

## Step 2. Stripe live mode (20 min, ONLY when ready to launch publicly)

Until then, test mode is correct. When you decide to take real money:

1. **Activate the account**: https://dashboard.stripe.com → toggle
   "Test mode" OFF (top right) → Stripe asks you to "Activate payments" →
   fill identity + bank details (payouts). Wait for approval (usually fast).
2. **Recreate the product in live mode** (live and test data are separate):
   Product catalogue → Add product → "Allowance Pro", recurring **$20/month**
   → copy the new live `price_...` id.
3. **Live webhook**: Developers → Webhooks → Add endpoint →
   URL `https://getallowance.dev/api/stripe/webhook` → subscribe to
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted` → copy the live `whsec_...`.
4. **Customer portal**: Settings → Billing → Customer portal → Activate
   (live mode has its own portal config).
5. **Swap the env vars in Vercel** (Settings → Environment Variables):
   - `STRIPE_SECRET_KEY` → the live `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET` → the live `whsec_...`
   - `STRIPE_PRO_PRICE_ID` → the live `price_...`
   Then Deployments → latest → ... → **Redeploy**.
6. **Verify**: upgrade with a REAL card (you can refund yourself from the
   Stripe dashboard right after), confirm the plan flips to Pro and
   "Manage billing" opens the live portal.

---

## Step 3. Launch (the only thing that matters now)

1. Open `docs/LAUNCH.md`. The Show HN post and outreach DMs are written.
2. Post the Show HN (Tue-Thu, 14:00-16:00 UTC). Reply to every comment for
   the first 2 hours.
3. Same day, drop the DM variants in: r/LocalLLaMA, r/OpenAI, r/SideProject,
   LangChain/CrewAI/AutoGen Discords, X replies under runaway-bill threads.
4. Goal: **10 developers with keys**. Track each one in `docs/VALIDATION.md`
   (scorecard + call questions are in there).
5. Weekly: run the activation SQL + the whale-check SQL (both in
   VALIDATION.md) from the Supabase SQL editor.
6. Decision gate: >= 3 of 10 activated and at least one "I'd pay" →
   build Phase 7 (webhooks, management API, teams). Fewer → reposition
   before writing more code.

---

## Step 4. Hardening sessions (do together with Claude, not urgent)

Bring these to a session when you have 30-60 min and are at the keyboard:

- **Restricted DB role**: swap the worker's all-powerful service_role key for
  a least-privilege role (4 functions only). Needs live testing with instant
  rollback ready. Say: "let's do the restricted DB role".
- **E2E test suite**: create a second (staging) Supabase project first, then
  say: "let's build the E2E suite" — Playwright will run signup → connect →
  key → call → 402 → revoke on every push.

---

## Ongoing habits (5 min/week)

- Glance at UptimeRobot + the status page (https://stats.uptimerobot.com/bewvMY4MqN).
- Run the two SQL checks in VALIDATION.md.
- If Discord pings an error burst: `cd proxy && npx wrangler tail` and read
  the runbook (`docs/RUNBOOK.md`).
