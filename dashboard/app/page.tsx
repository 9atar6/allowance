import Link from "next/link";
import { CodeBlock } from "@/components/marketing/code-block";
import { ThemeToggle } from "@/components/theme-toggle";
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
  title: "Allowance — One key. Every API. A hard cap.",
  description:
    "Route all your API spend through one key, with a prepaid limit and an instant kill switch. Works with any API. Built for apps and AI agents.",
};

const PROXY = "https://api.allowance.dev";

const HERO_CODE = `# Keep your code. Point the base URL at Allowance.
curl ${PROXY}/v1/proxy/chat/completions \\
  -H "Authorization: Bearer alw_live_your_key" \\
  -d '{ "model": "gpt-4o-mini", "messages": [ ... ] }'`;

const steps = [
  {
    n: "01",
    title: "Load a balance",
    body: "Add funds by card, or let an agent top up with USDC. That balance is the ceiling.",
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
  { icon: IconZap, title: "Edge-fast", body: "Checked at the edge. The extra hop is negligible." },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "",
    features: ["5,000 requests / mo", "Spend cap + kill switch", "One project"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$20",
    cadence: "/mo",
    features: [
      "1,000,000 requests / mo",
      "Unlimited projects + keys",
      "Per-key limits, 90-day analytics",
      "The x402 agent rail",
    ],
    cta: "Upgrade",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    features: ["Volume pricing", "SSO + team seats", "SLA + support"],
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
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Wordmark />
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/docs"
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            Docs
          </Link>
          <Link href="/login" className="btn-accent px-4 py-2 text-sm">
            Sign in
          </Link>
          <ThemeToggle />
        </nav>
      </header>

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
          prepaid limit they can never exceed, and kill a leaked key in a click.
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
              <ul className="mt-7 space-y-3 text-sm">
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
          <a
            href="https://github.com/9atar6/allowance"
            className="transition-colors hover:text-[var(--text)]"
          >
            GitHub
          </a>
          <Link href="/login" className="transition-colors hover:text-[var(--text)]">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
