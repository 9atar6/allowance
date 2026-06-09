import Link from "next/link";
import { CodeBlock } from "@/components/marketing/code-block";
import {
  IconCap,
  IconLayers,
  IconPower,
  IconShield,
  IconStream,
  IconZap,
} from "@/components/marketing/icons";

export const metadata = {
  title: "Allowance — One key. Every API. A hard cap.",
  description:
    "Route all your API spend through one key, with a prepaid limit and an instant kill switch. Works with any API. Built for apps and AI agents.",
};

const PROXY = "https://api.allowance.dev";

const HERO_CODE = `# Keep your code. Just point the base URL at Allowance.
curl ${PROXY}/v1/proxy/chat/completions \\
  -H "Authorization: Bearer alw_live_your_key" \\
  -d '{ "model": "gpt-4o-mini", "messages": [ ... ] }'`;

const steps = [
  {
    n: "01",
    title: "Load a balance",
    body: "Add funds by card, or let an agent top up with USDC. That balance is the ceiling: nothing you run can ever spend past it.",
  },
  {
    n: "02",
    title: "Connect your APIs",
    body: "Add the services you pay for and their secret keys. We seal them in a vault and hand you one Allowance key to use everywhere.",
  },
  {
    n: "03",
    title: "Route your traffic",
    body: "Point your base URL at Allowance. We forward each call, meter the cost, and stop with a 402 the instant the balance hits zero.",
  },
];

const features = [
  {
    icon: IconCap,
    title: "A hard spending cap",
    body: "At zero, the next request stops with a 402. No overdraft, and no surprise bill at the end of the month.",
  },
  {
    icon: IconPower,
    title: "An instant kill switch",
    body: "Revoke a key and it stops working within seconds. Disable an entire service the same way.",
  },
  {
    icon: IconLayers,
    title: "Any API, one key",
    body: "Not just AI. Maps, text messages, data feeds, your own internal tools. Anything billed per call.",
  },
  {
    icon: IconStream,
    title: "Streaming, untouched",
    body: "Live token streams pass straight through, so your AI responses arrive in real time, exactly as usual.",
  },
  {
    icon: IconShield,
    title: "Your keys stay sealed",
    body: "Real credentials are encrypted at rest and never written to a log. Clients only ever see the Allowance key.",
  },
  {
    icon: IconZap,
    title: "Edge-fast by design",
    body: "Keys and balances are checked at the network edge, so the extra hop adds almost nothing to each call.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "",
    blurb: "For tinkering and small projects.",
    features: [
      "5,000 requests per month",
      "Spending cap + instant kill switch",
      "One project",
      "Card and USDC top-ups",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$20",
    cadence: "/mo",
    blurb: "For production apps and agents.",
    features: [
      "1,000,000 requests per month",
      "Unlimited projects and keys",
      "Per-key daily limits",
      "90-day analytics + the x402 agent rail",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    blurb: "For teams at scale.",
    features: [
      "Volume pricing",
      "SSO and team seats",
      "SLA + priority support",
      "Custom limits and retention",
    ],
    cta: "Contact us",
    highlight: false,
  },
];

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--indigo-bright)]">
      {children}
    </p>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 font-display text-lg font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-lg btn-glow text-[13px]">
        A
      </span>
      Allowance
    </span>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      {/* Nav */}
      <header className="sticky top-0 z-20">
        <div className="mx-auto mt-4 flex max-w-5xl items-center justify-between rounded-2xl glass px-5 py-3">
          <Wordmark />
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/docs"
              className="rounded-lg px-3 py-2 text-[var(--text-muted)] transition-colors hover:text-white"
            >
              Docs
            </Link>
            <Link
              href="/login"
              className="rounded-lg btn-glow px-4 py-2 font-medium"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-20 text-center">
        <div className="animate-in">
          <Eyebrow>Spend control for APIs and AI agents</Eyebrow>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-6xl font-semibold leading-[1.04] sm:text-7xl">
            One key. Every API.
            <br />
            <span className="text-aurora">A hard cap.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[var(--text-muted)]">
            Route every API your apps and agents call through a single Allowance
            key. Set a prepaid limit they can never exceed, watch every request,
            and kill a leaked key in one click.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl btn-glow px-6 py-3 font-medium"
            >
              Get started
            </Link>
            <Link
              href="/docs"
              className="rounded-xl neu px-6 py-3 font-medium text-[var(--text-muted)] transition-colors hover:text-white"
            >
              Read the docs
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-2xl text-left animate-in" style={{ animationDelay: "0.15s" }}>
          <CodeBlock code={HERO_CODE} label="your terminal" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold">
            Three steps to a budget you control
          </h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="glass glass-hover rounded-[var(--radius)] p-7">
              <span className="font-mono text-sm text-[var(--indigo-bright)]">
                {s.n}
              </span>
              <h3 className="mt-4 font-display text-xl font-medium">{s.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-muted)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Two rails */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <Eyebrow>Built for both</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold">
            People and the bots they run
          </h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="glass glass-hover rounded-[var(--radius)] p-8">
            <h3 className="font-display text-xl font-medium">For people</h3>
            <p className="mt-3 leading-relaxed text-[var(--text-muted)]">
              Top up by card in a clean dashboard. See your balance, every
              charge, and recent activity at a glance. Add services and mint keys
              in seconds.
            </p>
          </div>
          <div className="glass glass-hover rounded-[var(--radius)] p-8">
            <h3 className="font-display text-xl font-medium">For agents</h3>
            <p className="mt-3 leading-relaxed text-[var(--text-muted)]">
              An agent that hits its cap can top itself up with USDC over the
              x402 standard and keep working. No card, no human in the loop.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <Eyebrow>Why Allowance</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold">
            A budget and a kill switch, built in
          </h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="glass glass-hover rounded-[var(--radius)] p-6"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl neu text-[var(--indigo-bright)]">
                  <Icon />
                </div>
                <h3 className="mt-5 font-display text-lg font-medium">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold">
            Fair, and free to start
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--text-muted)]">
            We never mark up your AI. You pay for the gateway, the controls, and
            the analytics. The cost of the services you call stays between you
            and them.
          </p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-[var(--radius)] p-7 ${
                p.highlight
                  ? "glass-strong ring-1 ring-[var(--indigo)]/40"
                  : "glass glass-hover"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-7 rounded-full btn-glow px-3 py-1 text-xs font-medium">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-lg font-medium">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-5xl font-semibold tracking-tight">
                  {p.price}
                </span>
                <span className="text-sm text-[var(--text-faint)]">
                  {p.cadence}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{p.blurb}</p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span className="text-[var(--indigo-bright)]">✓</span>
                    <span className="text-[var(--text-muted)]">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-7 rounded-xl px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                  p.highlight
                    ? "btn-glow"
                    : "neu text-[var(--text-muted)] hover:text-white"
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
        <div className="glass-strong rounded-[28px] px-8 py-16 text-center">
          <h2 className="font-display text-5xl font-semibold leading-tight">
            Give your agents an <span className="text-aurora">allowance</span>.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--text-muted)]">
            Set a budget your apps and agents can never blow past. It takes about
            two minutes to start.
          </p>
          <Link
            href="/login"
            className="mt-9 inline-block rounded-xl btn-glow px-7 py-3.5 font-medium"
          >
            Get started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--glass-border)]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-[var(--text-faint)] sm:flex-row">
          <Wordmark />
          <div className="flex gap-6">
            <Link href="/docs" className="transition-colors hover:text-white">
              Docs
            </Link>
            <a
              href="https://github.com/9atar6/allowance"
              className="transition-colors hover:text-white"
            >
              GitHub
            </a>
            <Link href="/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
