import Link from "next/link";
import { CodeBlock } from "@/components/marketing/code-block";

export const metadata = {
  title: "Allowance Docs",
  description: "Quickstart: route any API through Allowance in three steps.",
};

const PROXY = "https://api.allowance.dev";

const toc = [
  { id: "connect", label: "1. Connect a service" },
  { id: "key", label: "2. Create a key" },
  { id: "route", label: "3. Point your base URL" },
  { id: "streaming", label: "Streaming" },
  { id: "limit", label: "When the balance runs out" },
  { id: "funding", label: "Funding your balance" },
  { id: "revoke", label: "Revoke a key" },
];

function Mono({ children }: { children: string }) {
  return (
    <code className="neu-inset-sm px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--text)]">
      {children}
    </code>
  );
}

function Step({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-center gap-3">
        {n && (
          <span className="neu-sm grid h-8 w-8 shrink-0 place-items-center font-mono text-sm text-[var(--accent)]">
            {n}
          </span>
        )}
        <h2 className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-[var(--text-muted)]">
        {children}
      </div>
    </section>
  );
}

export default function Docs() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="sticky top-0 z-20 bg-[var(--bg)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-semibold"
          >
            <span className="neu-sm grid h-7 w-7 place-items-center text-[13px] text-accent">
              A
            </span>
            Allowance
          </Link>
          <Link href="/login" className="btn-accent px-4 py-2 text-sm font-medium">
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-[200px_1fr]">
          {/* Table of contents */}
          <aside className="hidden lg:block">
            <nav className="sticky top-28 space-y-1 text-sm">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">
                On this page
              </p>
              {toc.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className="block py-1 text-[var(--text-muted)] transition-colors hover:text-white"
                >
                  {t.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="min-w-0">
            <h1 className="text-5xl font-semibold tracking-tight">
              Quickstart
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-[var(--text-muted)]">
              Allowance is a prepaid proxy for any pay-per-use API. You load a
              balance, route your traffic through one key, and it stops at zero.
              Here is the whole thing in three steps.
            </p>

            <div className="mt-12 space-y-14">
              <Step id="connect" n="1" title="Connect a service">
                <p>
                  In the{" "}
                  <Link
                    href="/dashboard"
                    className="text-[var(--accent)] hover:underline"
                  >
                    dashboard
                  </Link>
                  , add the API you want to put a budget on: its base URL and the
                  auth header it normally needs. For example, name{" "}
                  <Mono>OpenAI</Mono>, URL <Mono>https://api.openai.com/v1</Mono>,
                  header <Mono>Authorization: Bearer sk-...</Mono>.
                </p>
                <p>
                  Those credentials are encrypted in a vault. We never store or
                  log them in plain text.
                </p>
              </Step>

              <Step id="key" n="2" title="Create a key">
                <p>
                  Click <strong className="text-white">Create proxy key</strong> on
                  the service. You get one key, shown a single time, like{" "}
                  <Mono>alw_live_...</Mono>. This is what your app or agent sends,
                  in place of your real API key.
                </p>
              </Step>

              <Step id="route" n="3" title="Point your base URL at the proxy">
                <p>
                  Keep your code exactly the same. Swap the API host for the
                  Allowance proxy and use your <Mono>alw_live_</Mono> key.
                  Everything after <Mono>/v1/proxy</Mono> is forwarded to your
                  service.
                </p>
                <CodeBlock
                  label="bash"
                  code={`# Before
curl https://api.openai.com/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-real-key" ...

# After
curl ${PROXY}/v1/proxy/chat/completions \\
  -H "Authorization: Bearer alw_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{ "model": "gpt-4o-mini", "messages": [{"role":"user","content":"hi"}] }'`}
                />
                <p>
                  Allowance removes your <Mono>alw_</Mono> key, adds your real
                  credentials, forwards the call, streams the response back, and
                  subtracts the cost from your balance.
                </p>
              </Step>

              <Step id="streaming" title="Streaming works out of the box">
                <p>
                  Live token streams pass straight through. Add{" "}
                  <Mono>{`"stream": true`}</Mono> and read the response exactly as
                  you would from the service directly.
                </p>
              </Step>

              <Step id="limit" title="When the balance runs out">
                <p>
                  At zero, the proxy stops the request and returns{" "}
                  <Mono>402 Payment Required</Mono> with a small JSON body. No
                  overdraft, no surprise bill.
                </p>
                <CodeBlock
                  label="402 response"
                  code={`{
  "x402Version": 1,
  "error": "PAYMENT_REQUIRED",
  "accepts": [
    { "scheme": "prepaid", "maxAmountRequired": 0.01, "balanceRemaining": 0 }
  ]
}`}
                />
              </Step>

              <Step id="funding" title="Funding your balance">
                <p>
                  <strong className="text-white">People</strong> top up by card in
                  the dashboard. <strong className="text-white">Agents</strong> top
                  up programmatically with USDC over x402, with no card and no
                  human needed.
                </p>
                <CodeBlock
                  label="bash"
                  code={`# An agent tops itself up $5 in USDC.
# With no payment attached, this returns 402 + payment details.
# An x402 client (such as x402-fetch) signs and retries automatically.
curl -X POST ${PROXY}/v1/topup/5 \\
  -H "Authorization: Bearer alw_live_your_key"`}
                />
                <p>Top-up amounts: $5, $10, $25, $50, $100.</p>
              </Step>

              <Step id="revoke" title="Revoke a leaked key">
                <p>
                  Click <strong className="text-white">Revoke</strong> in the
                  dashboard. The key stops working at the edge within seconds and
                  every further request returns <Mono>401</Mono>. You can disable a
                  whole service the same way.
                </p>
              </Step>
            </div>

            <div className="mt-16 border-t border-white/5 pt-10">
              <Link
                href="/login"
                className="btn-accent inline-block px-6 py-3 font-medium"
              >
                Get started
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
