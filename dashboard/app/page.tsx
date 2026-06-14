import Link from "next/link";
import { HeroField } from "@/components/hero-field";
import { SiteNav } from "@/components/site-nav";
import { Wordmark } from "@/components/wordmark";

export const metadata = {
  title: "Allowance: pocket money for software.",
  description:
    "Your apps and agents get one key with a hard cap. At zero, the answer is no. Leaked? Revoke it and it's dead everywhere in seconds. Works with any API.",
};

const PROXY = "https://api.getallowance.dev";

const steps = [
  {
    n: "01",
    title: "Set the cap",
    body: "Decide what your software may spend. That number is a wall, not a suggestion.",
  },
  {
    n: "02",
    title: "Seal your keys",
    body: "Hand us the real credentials. We encrypt them and hand back one allowance.",
  },
  {
    n: "03",
    title: "Route and relax",
    body: "Point your base URL at us. Every call is metered. At zero: declined.",
  },
];

const facts = [
  ["A hard cap", "At zero, the next call is declined. No overdraft."],
  ["Instant revoke", "Kill a key and it's dead everywhere within seconds."],
  ["Any API", "Not just AI. Maps, SMS, data, your own services."],
  ["Streaming", "Token streams pass straight through, in real time."],
  ["Sealed keys", "Real credentials are encrypted and never logged."],
  ["Pocket money", "Hand a sub-agent a capped child key. It can't exceed it."],
];

function Caps({ children }: { children: string }) {
  return <p className="label-caps">{children}</p>;
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      {/* Hero */}
      <section className="relative mx-auto max-w-3xl px-6 pt-20 pb-24 text-center animate-in">
        <HeroField />
        <Caps>Spend control for software</Caps>
        <h1 className="font-display mx-auto mt-7 text-6xl sm:text-7xl">
          Pocket money
          <br />
          for software.
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-pretty text-[17px] leading-relaxed text-[var(--text-muted)]">
          Your apps and agents get one key with a hard cap.
          <br className="hidden sm:inline" /> At zero, the answer is no.
          <br className="hidden sm:inline" /> Leaked? Revoke it and it&apos;s
          dead everywhere in seconds.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link href="/login" className="btn-accent px-6 py-3 text-sm">
            Open an account
          </Link>
          <Link
            href="/docs"
            className="neu-sm pressable px-6 py-3 text-sm font-medium text-[var(--text-muted)]"
          >
            Read the ledger
          </Link>
        </div>
        <a
          href="https://github.com/9atar6/allowance"
          className="mt-6 inline-flex items-center gap-2 text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-1.94c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.12v3.15c0 .3.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
          Open source. Verify every claim in the code.
        </a>

        {/* Hero receipt: the canonical money display, not a fake terminal. */}
        <div className="receipt mx-auto mt-16 max-w-md p-7 text-left text-[13px]">
          <div className="text-center">
            <p className="font-display text-lg lowercase tracking-tight">allowance</p>
            <p className="mt-1 label-caps">spend receipt</p>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--text-faint)]">
            <span>jun 2026</span>
            <span>no. 00481 · utc</span>
          </div>
          <div className="my-3 border-t border-dashed border-[var(--line-strong)]" />
          {[
            ["openai · gpt-4o-mini", "1,204 calls", "-$2.10"],
            ["openai · gpt-4o", "96 calls", "-$0.96"],
            ["anthropic · haiku", "318 calls", "-$0.32"],
            ["maps · geocode", "410 calls", "-$0.41"],
            ["twilio · verify", "18 calls", "-$0.18"],
            ["sub-agent · research", "pocket money", "-$0.61"],
          ].map(([svc, sub, amt]) => (
            <div key={svc} className="mt-2 receipt-line">
              <span className="text-[var(--text-muted)]">
                {svc}
                <span className="ml-2 text-[11px] text-[var(--text-faint)]">{sub}</span>
              </span>
              <span className="leader" />
              <span className="tabular-nums text-[var(--text-muted)]">{amt}</span>
            </div>
          ))}
          <div className="my-3 border-t border-dashed border-[var(--line-strong)]" />
          <div className="receipt-line">
            <span className="text-[var(--text-faint)]">spent this month</span>
            <span className="leader" />
            <span className="tabular-nums text-[var(--text-faint)]">-$4.58</span>
          </div>
          <div className="mt-2 receipt-line text-base">
            <span className="text-[var(--text)]">left of $5.00 cap</span>
            <span className="leader" />
            <span className="tabular-nums font-medium text-[var(--vault)]">$0.42</span>
          </div>
          <div className="mt-5 text-center text-[11px] tracking-[0.16em] text-[var(--text-faint)]">
            ALLOW ONCE · NO OVERDRAFTS
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <Caps>How it works</Caps>
          <h2 className="font-display mt-4 text-4xl">Three steps to a wall</h2>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded border border-[var(--line)] bg-[var(--line)] md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="bg-[var(--bg)] p-8">
              <span className="font-mono text-sm text-[var(--vault)]">{s.n}</span>
              <h3 className="font-display mt-4 text-xl">{s.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-muted)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Built for agents */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <Caps>Built for agents</Caps>
            <h2 className="font-display mt-4 text-4xl">
              Your agent can read
              <br />
              its own allowance.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--text-muted)]">
              A wall you can&apos;t see is hostile. Ours is visible from a
              distance: spend headers on every response, self-inspection at{" "}
              <span className="font-mono text-[var(--text)]">/v1/me</span>, and a
              402 that explains what tripped and what to do. Agents finish the
              job on a cheaper model instead of dying mid-run. They can even hand
              a sub-agent its own pocket money.
            </p>
            <a
              href="https://github.com/9atar6/allowance/tree/main/mcp"
              className="mt-7 inline-block text-sm font-medium text-[var(--vault)] hover:underline"
            >
              Get the MCP server →
            </a>
          </div>
          <div className="receipt p-6 text-sm">
            <span className="label-caps">your agent, mid-task</span>
            <pre className="mt-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-[var(--text-muted)]">
{`> check_budget

{
  "plan": "pro",
  "budgetRemaining": 1.42,
  "dailyCap": {
    "limit": 5,
    "remaining": 1.42
  }
}

# 71% spent. Switching to
# gpt-4o-mini to finish.`}
            </pre>
          </div>
        </div>
      </section>

      {/* Why — the ledger of facts */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <Caps>What you get</Caps>
          <h2 className="font-display mt-4 text-4xl">A wall and a kill switch</h2>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([title, body]) => (
            <div key={title} className="bg-[var(--bg)] p-6">
              <h3 className="font-display text-lg">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <Caps>Pricing</Caps>
        <h2 className="font-display mt-4 text-4xl">Free to start</h2>
        <p className="mx-auto mt-5 max-w-lg text-[var(--text-muted)]">
          We never mark up your tokens. Your providers bill you directly, as
          before. You pay for the ledger, not the spend.
        </p>
        <div className="mx-auto mt-12 grid max-w-3xl gap-px overflow-hidden rounded border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3 text-left">
          {[
            ["Free", "$0", ["5,000 requests / mo", "Hard cap + kill switch", "Projects, keys, pocket money", "Rotation + ephemeral keys"]],
            ["Pro", "$20", ["Everything in Free", "No monthly request cap", "Usage analytics", "Spend webhooks"]],
            ["Self-host", "$0", ["Run your own instance", "Your Supabase + Cloudflare", "We see nothing", "MIT licensed"]],
          ].map(([name, price, feats]) => (
            <div key={name as string} className="bg-[var(--bg)] p-7">
              <h3 className="font-display text-xl">{name as string}</h3>
              <p className="mt-3 font-mono text-3xl tabular-nums">{price as string}</p>
              <ul className="mt-6 space-y-2.5 text-sm text-[var(--text-muted)]">
                {(feats as string[]).map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span className="text-[var(--vault)]">·</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto mt-12 max-w-5xl px-6 py-12">
        <div className="border-t border-[var(--line)] pt-10">
          <p className="font-display text-2xl">Allow once.</p>
          <div className="mt-6 flex flex-col items-start justify-between gap-4 text-sm text-[var(--text-faint)] sm:flex-row sm:items-center">
            <Link href="/"><Wordmark /></Link>
            <div className="flex flex-wrap gap-6">
              <Link href="/docs" className="hover:text-[var(--text)]">Docs</Link>
              <Link href="/security" className="hover:text-[var(--text)]">Security</Link>
              <Link href="/terms" className="hover:text-[var(--text)]">Terms</Link>
              <Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link>
              <a href="https://github.com/9atar6/allowance" className="hover:text-[var(--text)]">GitHub</a>
              <a href="https://stats.uptimerobot.com/bewvMY4MqN" className="hover:text-[var(--text)]">Status</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
