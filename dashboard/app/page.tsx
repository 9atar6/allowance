import Link from "next/link";
import { CodeBlock } from "@/components/marketing/code-block";
import { CursorFx } from "@/components/cursor-fx";
import { SiteNav } from "@/components/site-nav";
import { Wordmark } from "@/components/wordmark";
import {
  IconCap,
  IconLayers,
  IconPower,
  IconShield,
  IconStream,
  IconZap,
} from "@/components/marketing/icons";

export const metadata = {
  title: "Allowance: One key. Every API. A hard cap.",
  description:
    "Route all your API spend through one key, with a spending cap your apps and agents can never exceed and an instant kill switch. Works with any API.",
};

// The live proxy host.
const PROXY = "https://api.getallowance.dev";

const HERO_CODE = `# Keep your code. Point the base URL at Allowance.
curl ${PROXY}/v1/proxy/chat/completions \\
  -H "Authorization: Bearer alw_live_your_key" \\
  -d '{ "model": "gpt-4o-mini", "messages": [ ... ] }'`;

const steps = [
  {
    n: "01",
    title: "Set a budget",
    body: "Tell Allowance how much your apps and agents may spend. That cap is the ceiling, nothing can ever go past it.",
  },
  {
    n: "02",
    title: "Connect your APIs",
    body: "Add a service and its key. We vault the secret and hand you one key to use everywhere.",
  },
  {
    n: "03",
    title: "Route your traffic",
    body: "Point your base URL at Allowance. We meter each call and stop at zero with a 402.",
  },
];

const features = [
  { icon: IconCap, title: "A hard cap", body: "At zero, the next call stops with a 402. No overdraft." },
  { icon: IconPower, title: "Instant kill switch", body: "Revoke a key and it dies within seconds." },
  { icon: IconLayers, title: "Any API", body: "Not just AI. Maps, SMS, data, your own services." },
  { icon: IconStream, title: "Streaming", body: "Token streams pass straight through, in real time." },
  { icon: IconShield, title: "Sealed keys", body: "Real credentials are encrypted and never logged." },
  { icon: IconZap, title: "Agent-aware", body: "Spend headers on every response, self-inspection at /v1/me, webhooks at 50/80/100%." },
];

// Only claims that are actually enforced/built today. Update as features land.
const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "",
    features: [
      "5,000 requests / mo",
      "Hard budget cap + kill switch",
      "Projects, keys, rotation, ephemeral keys",
      "Monthly auto-refill + spend webhooks",
      "Low-budget email alerts",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$20",
    cadence: "/mo",
    features: [
      "Everything in Free",
      "No monthly request cap (fair use)",
      "Usage analytics (trends + top services)",
    ],
    cta: "Upgrade",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    features: ["Custom limits", "Team features on request", "Priority support"],
    cta: "Contact us",
    highlight: false,
  },
];

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-faint)]">
      {children}
    </p>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <CursorFx />
      <SiteNav />

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-24 text-center animate-in">
        <Eyebrow>Spend control for APIs and AI agents</Eyebrow>
        <h1 className="mx-auto mt-7 text-6xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-7xl">
          One key. Every API.
          <br />
          <span className="text-accent">A hard cap.</span>
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-[17px] leading-relaxed text-[var(--text-muted)]">
          Route every API your apps and agents call through one key. Set a
          spending cap they can never exceed, and kill a leaked key in a click.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link href="/login" className="btn-accent px-6 py-3">
            Get started
          </Link>
          <Link
            href="/docs"
            className="neu-sm pressable px-6 py-3 text-sm font-medium text-[var(--text-muted)]"
          >
            Read the docs
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
        <div className="mx-auto mt-16 max-w-xl text-left">
          <CodeBlock code={HERO_CODE} label="your terminal" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">
            Three steps to a budget you control
          </h2>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="neu p-7">
              <span className="font-mono text-sm text-accent">{s.n}</span>
              <h3 className="mt-5 text-lg font-medium tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-muted)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center">
          <Eyebrow>Why Allowance</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">
            A budget and a kill switch, built in
          </h2>
        </div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="neu p-6">
                <div className="neu-inset-sm grid h-10 w-10 place-items-center text-accent">
                  <Icon />
                </div>
                <h3 className="mt-5 font-medium tracking-tight">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Built for agents */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <Eyebrow>Built for agents</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Your agent can read
              <br />
              its own budget
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--text-muted)]">
              A hard wall is hostile to autonomous agents. Allowance makes the
              wall visible from a distance: every response carries spend
              headers, a key can inspect itself at{" "}
              <code className="font-mono text-sm text-[var(--text)]">
                /v1/me
              </code>
              , and every 402 explains what tripped and what to do next. So an
              agent finishes the task on a cheaper model instead of dying
              mid-run.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-[var(--text-muted)]">
              <li className="flex gap-2.5">
                <span className="text-accent">→</span>
                x-allowance-* headers on every response
              </li>
              <li className="flex gap-2.5">
                <span className="text-accent">→</span>
                Webhooks at 50%, 80%, and 100% of budget
              </li>
              <li className="flex gap-2.5">
                <span className="text-accent">→</span>
                MCP server: budget tools your agent calls itself
              </li>
            </ul>
            <a
              href="https://github.com/9atar6/allowance/tree/main/mcp"
              className="mt-7 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Get allowance-mcp →
            </a>
          </div>
          <CodeBlock
            label="your agent, mid-task"
            code={`> check_budget

{
  "plan": "pro",
  "budgetRemaining": 1.42,
  "dailyCap": { "limit": 5, "spent": 3.58, "remaining": 1.42 }
}

# 71% spent. Switching to gpt-4o-mini to finish the run.`}
          />
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">
            Fair, and free to start
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[var(--text-muted)]">
            We never mark up your AI. You pay for the gateway, not the tokens.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col p-7 ${p.highlight ? "neu-lg" : "neu"}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium tracking-tight">{p.name}</h3>
                {p.highlight && (
                  <span className="neu-inset-sm px-2.5 py-1 text-[11px] font-medium text-accent">
                    Popular
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">
                  {p.price}
                </span>
                <span className="text-sm text-[var(--text-faint)]">
                  {p.cadence}
                </span>
              </div>
              <ul className="mt-7 flex-1 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[var(--text-muted)]">
                    <span className="text-accent">·</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-8 px-4 py-2.5 text-center text-sm font-medium ${
                  p.highlight
                    ? "btn-accent"
                    : "neu-sm pressable text-[var(--text-muted)]"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <div className="neu-lg px-8 py-16 text-center">
          <h2 className="text-4xl font-semibold tracking-tight">
            Give your agents an <span className="text-accent">allowance</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[var(--text-muted)]">
            A budget your apps and agents can never blow past. Two minutes to
            start.
          </p>
          <Link href="/login" className="btn-accent mt-9 inline-block px-7 py-3">
            Get started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-10 text-sm text-[var(--text-faint)] sm:flex-row">
        <Wordmark />
        <div className="flex gap-6">
          <Link href="/docs" className="transition-colors hover:text-[var(--text)]">
            Docs
          </Link>
          <Link href="/security" className="transition-colors hover:text-[var(--text)]">
            Security
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[var(--text)]">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-[var(--text)]">
            Privacy
          </Link>
          <a
            href="https://github.com/9atar6/allowance"
            className="transition-colors hover:text-[var(--text)]"
          >
            GitHub
          </a>
          <a
            href="https://stats.uptimerobot.com/bewvMY4MqN"
            className="transition-colors hover:text-[var(--text)]"
          >
            Status
          </a>
        </div>
      </footer>
    </div>
  );
}
