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
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Allowance: a prepaid debit card for your AI",
  description:
    "A prepaid account for the APIs your apps and AI agents pay to use. Load a balance, route everything through one key, stop at zero.",
};

const PROXY = "https://api.allowance.dev";

const HERO_CODE = `# Keep your code the same. Point the base URL at Allowance.
curl ${PROXY}/v1/proxy/chat/completions \\
  -H "Authorization: Bearer alw_live_your_key" \\
  -d '{ "model": "gpt-4o-mini", "messages": [ ... ] }'`;

const steps = [
  {
    n: "1",
    title: "Load a balance",
    body: "Add money with a card, or with crypto (USDC) if you are an agent. That balance is the most anything can ever spend.",
  },
  {
    n: "2",
    title: "Connect a service, get a key",
    body: "Add the API you use and your login for it. We lock those credentials in a vault and give you one key to use instead.",
  },
  {
    n: "3",
    title: "Route and relax",
    body: "Send your traffic through Allowance. We pass it on, subtract the cost, and stop the moment the balance hits zero.",
  },
];

const features = [
  {
    icon: IconCap,
    title: "A hard spending cap",
    body: "At zero, the request stops with a 402. No overdraft, and no surprise bill at the end of the month.",
  },
  {
    icon: IconPower,
    title: "A one-click kill switch",
    body: "If a key leaks, revoke it and it stops working within seconds. Disable a whole service the same way.",
  },
  {
    icon: IconLayers,
    title: "Works with any service",
    body: "Not just AI. Anything you pay for per use: maps, text messages, data feeds, your own internal tools.",
  },
  {
    icon: IconStream,
    title: "Streaming included",
    body: "Live token streams pass straight through, so your AI responses arrive in real time, exactly as usual.",
  },
  {
    icon: IconShield,
    title: "Your keys stay sealed",
    body: "Your real API credentials are encrypted at rest and never written to a log. Apps only ever see the Allowance key.",
  },
  {
    icon: IconZap,
    title: "Fast by design",
    body: "Keys and balances are checked at the network edge, so the extra step adds almost nothing to each request.",
  },
];

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
      {children}
    </p>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-neutral-200/70 bg-neutral-100/80 backdrop-blur dark:border-neutral-800/70 dark:bg-neutral-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold">Allowance</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/docs"
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            >
              Docs
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Sign in
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
        <Eyebrow>Prepaid spending for AI and APIs</Eyebrow>
        <h1 className="mx-auto mt-5 max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          A prepaid debit card for your AI.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
          Allowance is a prepaid account for the online services your apps and AI
          agents pay to use. Load a balance, connect any service, and run it all
          through a single key. We count every request, stop the instant you hit
          zero, and let you kill a leaked key on the spot.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-neutral-900 px-5 py-3 font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Get started
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-neutral-300 px-5 py-3 font-medium hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500"
          >
            Read the docs
          </Link>
        </div>
        <div className="mx-auto mt-14 max-w-2xl text-left">
          <CodeBlock code={HERO_CODE} label="your terminal" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Three steps to a budget you control
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-neutral-200 bg-white p-7 dark:border-neutral-800 dark:bg-neutral-800/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-base font-semibold text-emerald-600 dark:text-emerald-400">
                {s.n}
              </div>
              <h3 className="mt-5 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Two rails */}
      <section className="border-y border-neutral-200 bg-white py-20 dark:border-neutral-800 dark:bg-neutral-950/40">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <Eyebrow>Two ways to fund it</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Built for people and the bots they run
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 p-8 dark:border-neutral-800">
              <h3 className="text-lg font-medium">For people</h3>
              <p className="mt-3 leading-relaxed text-neutral-600 dark:text-neutral-300">
                Top up by card in a simple dashboard. See your balance, every
                charge, and your recent activity. Add services and create keys in
                seconds.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 p-8 dark:border-neutral-800">
              <h3 className="text-lg font-medium">For agents</h3>
              <p className="mt-3 leading-relaxed text-neutral-600 dark:text-neutral-300">
                An AI agent can top itself up with USDC over the x402 payment
                standard and keep working, with no card and no human in the loop.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <Eyebrow>Why Allowance</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            A budget and a kill switch, built in
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-neutral-200 bg-white p-6 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-800/40 dark:hover:border-neutral-700"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Icon />
                </div>
                <h3 className="mt-4 font-medium">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h2 className="text-4xl font-semibold tracking-tight">
          Give your agents an allowance.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-600 dark:text-neutral-300">
          Set a budget your apps and agents can never blow past. It takes about
          two minutes to start.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-lg bg-neutral-900 px-6 py-3 font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Get started
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-neutral-500 sm:flex-row">
          <span>Allowance</span>
          <div className="flex gap-6">
            <Link href="/docs" className="hover:text-neutral-900 dark:hover:text-neutral-300">
              Docs
            </Link>
            <a
              href="https://github.com/9atar6/allowance"
              className="hover:text-neutral-900 dark:hover:text-neutral-300"
            >
              GitHub
            </a>
            <Link href="/login" className="hover:text-neutral-900 dark:hover:text-neutral-300">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
