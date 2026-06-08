import Link from "next/link";
import { CodeBlock } from "@/components/marketing/code-block";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <code className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-[0.85em] text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
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
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3">
        {n && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {n}
          </span>
        )}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

export default function Docs() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200/70 bg-neutral-100/80 backdrop-blur dark:border-neutral-800/70 dark:bg-neutral-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">
            Allowance
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Sign in
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-[200px_1fr]">
          {/* Table of contents */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1 text-sm">
              <p className="mb-3 font-medium text-neutral-900 dark:text-neutral-100">
                On this page
              </p>
              {toc.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className="block py-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                >
                  {t.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="min-w-0">
            <h1 className="text-4xl font-semibold tracking-tight">Quickstart</h1>
            <p className="mt-4 text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
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
                    className="text-emerald-600 hover:underline dark:text-emerald-400"
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
                  Click <strong>Create proxy key</strong> on the service. You get
                  one key, shown a single time, like <Mono>alw_live_...</Mono>.
                  This is what your app or agent sends, in place of your real API
                  key.
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
                  <strong>People</strong> top up by card in the dashboard.{" "}
                  <strong>Agents</strong> top up programmatically with USDC over
                  x402, with no card and no human needed.
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
                  Click <strong>Revoke</strong> in the dashboard. The key stops
                  working at the edge within seconds and every further request
                  returns <Mono>401</Mono>. You can disable a whole service the
                  same way.
                </p>
              </Step>
            </div>

            <div className="mt-16 border-t border-neutral-200 pt-10 dark:border-neutral-800">
              <Link
                href="/login"
                className="inline-block rounded-lg bg-neutral-900 px-5 py-3 font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
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
