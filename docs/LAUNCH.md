# Launch assets

Ready-to-post drafts. Personalize the bracketed bits, never the core claim —
every sentence here is true of the product as built.

---

## Show HN post

**Title (pick one):**

> Show HN: Allowance – a hard spending cap for the APIs your AI agents call
>
> Show HN: I built a kill switch and budget cap for runaway AI agents

**Body:**

> I kept reading horror stories about agents stuck in a loop racking up API
> bills overnight (and had a small scare myself), so I built Allowance.
>
> It's a BYOK proxy: you add the API keys you already have (OpenAI, Anthropic,
> anything HTTP), set a budget, and route your traffic through one Allowance
> key. Every call is metered at the edge — per-token for the big AI providers,
> flat-rate for anything else — and the moment your budget, a project's monthly
> cap, or a key's daily cap is hit, calls stop with a 402. Leaked key? Revoke
> it and it dies globally in seconds.
>
> Important detail: Allowance never touches your provider billing. Your
> providers charge you directly, as before. The budget is a free guardrail,
> not a wallet — so there's nothing to double-pay and no markup on your AI.
>
> Stack: Cloudflare Workers (Hono) at the edge, Supabase (Postgres + Vault for
> credential encryption), Next.js dashboard. Keys are stored as SHA-256 hashes;
> provider credentials are AES-256-GCM encrypted and never logged; request and
> response bodies are never stored.
>
> Free for 5k requests/month. I'd genuinely love to hear how you cap agent
> spend today — dashboard limits? nothing? — and what would make this useful
> enough to switch.
>
> https://getallowance.dev

**HN survival notes:** post Tue–Thu, 14:00–16:00 UTC. Reply to every comment
within the first 2 hours. Don't argue; ask what they'd need. The "how do you
cap spend today" question is the data you actually want.

---

## Outreach DM (Discord / X / Reddit)

**Variant A — the burned:**

> Hey — saw your post about [their runaway-bill / agent-loop story]. I got
> burned the same way, so I built a hard budget cap that sits in front of any
> API key: agent hits the cap, calls stop with a 402, nothing overdrafts.
> It's free (BYOK, your provider still bills you directly). Would you try it
> and tell me where it sucks? Takes ~2 min to set up: [link]

**Variant B — the builder:**

> Hey, you build agents — quick question: how do you stop one from blowing
> through your OpenAI budget if it loops? I built a per-key/per-project hard
> cap + instant kill switch (free, bring-your-own-key) and I'm looking for 10
> people to break it before I launch properly. Interested?

**Where to post:** r/LocalLLaMA, r/OpenAI, r/SideProject, AI-agent Discords
(LangChain, CrewAI, AutoGen communities), X replies to runaway-bill threads,
Indie Hackers.

**Rules:** lead with their pain, not your product. One link max. Always end
with a question. Never post the same text twice in one community.

---

## Activation metric (check weekly)

A user counts as **activated** when ALL of:
1. Connected a real API (a connection whose target isn't httpbin/example).
2. ≥ 50 proxied requests (`usage_events` count for their user_id).
3. Active again in their second week (any request > 7 days after their first).

Check with the SQL in `docs/VALIDATION.md`.

**Decision gate:** 10 users contacted-and-keyed → if **≥ 3 activate** and at
least one says they'd pay, double down (build Phase 7). If not, stop building
and reposition — the audience or the pain statement is wrong, not the code.
