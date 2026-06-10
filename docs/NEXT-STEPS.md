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

## Step 2. Go live with payments via Polar (15 min, when ready to launch)

Polar is the merchant of record: it sells on your behalf, handles taxes, and
pays you out as an individual. No URSSAF, no company. The code is already
wired — you only configure your Polar account and three env vars.

1. **Product**: polar.sh dashboard → Products → New Product →
   name "Allowance Pro" → Subscription → **$20 / month** → create.
   Open it and copy the **Product ID**.
2. **Access token**: Settings → Developers → **New token** → name
   "allowance-dashboard", select all scopes (or at minimum checkouts +
   customer sessions) → copy the `polar_oat_...` token (shown once).
3. **Webhook**: Settings → Webhooks → **Add endpoint** →
   URL `https://getallowance.dev/api/polar/webhook` → Format **Raw** →
   select all `subscription.*` events → save → copy the **secret**.
4. **Vercel env vars** (Settings → Environment Variables, all three, then
   Deployments → latest → ... → Redeploy):
   - `POLAR_ACCESS_TOKEN` = the token from step 2
   - `POLAR_WEBHOOK_SECRET` = the secret from step 3
   - `POLAR_PRO_PRODUCT_ID` = the id from step 1
5. **Verify**: dashboard → Upgrade to Pro → complete the Polar checkout with a
   real card (you can refund yourself from Polar afterwards) → plan flips to
   Pro → "Manage billing" opens the Polar portal.

Payouts: Polar → Finance → connect your personal bank account.

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
