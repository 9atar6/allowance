import Link from "next/link";

export const metadata = {
  title: "Allowance — a prepaid debit card for your AI",
  description:
    "Load a balance, route any API through one key, and stop at zero. Spend caps and a kill switch for you and your agents.",
};

const steps = [
  {
    n: "1",
    title: "Load a balance",
    body: "Top up with a card through Stripe, or with USDC over x402. Agents can fund themselves, no human needed.",
  },
  {
    n: "2",
    title: "Add an API, get a key",
    body: "Paste any API's URL and your credentials. We seal them in a vault and hand you one proxy key.",
  },
  {
    n: "3",
    title: "Route and relax",
    body: "Send traffic through the proxy. We forward it, deduct the cost, and hard-stop at zero with HTTP 402.",
  },
];

const features = [
  {
    title: "Hard spending cap",
    body: "At zero, the proxy returns 402 and stops. No overdraft, no surprise invoice.",
  },
  {
    title: "One-click kill switch",
    body: "Revoke a leaked key and it dies at the edge within seconds, not minutes.",
  },
  {
    title: "Any API, not just AI",
    body: "Anything you pay per use works: maps, SMS, data feeds, internal tools.",
  },
  {
    title: "Streaming included",
    body: "Server-sent events pass straight through. Your token stream stays untouched.",
  },
  {
    title: "Credentials stay sealed",
    body: "Your real API keys are encrypted in Supabase Vault and never logged.",
  },
  {
    title: "Built on the edge",
    body: "Keys and balances are checked at Cloudflare's edge, so the overhead is tiny.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold text-white">Allowance</span>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/docs" className="text-neutral-400 hover:text-white">
            Docs
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-white px-4 py-2 font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-20 text-center">
        <p className="text-sm font-medium text-emerald-400">
          Prepaid API spending, for humans and agents
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-white">
          A prepaid debit card for your AI.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
          Load a balance, plug in any API, and get one key to rule them all.
          Allowance meters every call, stops at zero, and lets you kill a leaked
          key in one click. Your real credentials never leave the vault.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-white px-5 py-3 font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Get started free
          </Link>
          <Link
            href="/docs"
            className="rounded-md border border-neutral-700 px-5 py-3 font-medium text-neutral-200 hover:border-neutral-500"
          >
            Read the docs
          </Link>
        </div>

        {/* Code snippet */}
        <div className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 text-left">
          <div className="flex gap-1.5 border-b border-neutral-800 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-neutral-700" />
            <span className="h-3 w-3 rounded-full bg-neutral-700" />
            <span className="h-3 w-3 rounded-full bg-neutral-700" />
          </div>
          <pre className="overflow-x-auto px-5 py-4 text-sm leading-relaxed text-neutral-300">
            <code>{`# Same code. Just point the base URL at Allowance.
curl https://your-proxy.workers.dev/v1/proxy/chat/completions \\
  -H "Authorization: Bearer alw_live_your_key" \\
  -d '{ "model": "gpt-4o-mini", "messages": [ ... ] }'`}</code>
          </pre>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold text-white">
          How it works
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-400">
                {s.n}
              </div>
              <h3 className="mt-4 font-medium text-white">{s.title}</h3>
              <p className="mt-2 text-sm text-neutral-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two rails */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold text-white">
          Built for people and the bots they run
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-7">
            <h3 className="font-medium text-white">For people</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Top up by card through a simple dashboard. Watch your balance and
              every charge, set up your endpoints, and mint keys in seconds.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-7">
            <h3 className="font-medium text-white">For agents</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Fund and pay programmatically with USDC over the x402 protocol. An
              agent can top itself up and keep working, with no card and no human
              in the loop.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-neutral-800 p-6">
              <h3 className="font-medium text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-neutral-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold text-white">
          Give your agents an allowance.
        </h2>
        <p className="mt-3 text-neutral-400">
          Start with a balance in two minutes.
        </p>
        <Link
          href="/login"
          className="mt-7 inline-block rounded-md bg-white px-6 py-3 font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Get started free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-neutral-500 sm:flex-row">
          <span>Allowance</span>
          <div className="flex gap-6">
            <Link href="/docs" className="hover:text-neutral-300">
              Docs
            </Link>
            <a
              href="https://github.com/9atar6/allowance"
              className="hover:text-neutral-300"
            >
              GitHub
            </a>
            <Link href="/login" className="hover:text-neutral-300">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
