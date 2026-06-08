import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Docs — Allowance",
  description: "Quickstart: route any API through Allowance in three steps.",
};

const PROXY = "https://api.allowance.dev";

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      <code>{children}</code>
    </pre>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-neutral-200 py-10 dark:border-neutral-800">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        {children}
      </div>
    </section>
  );
}

function Mono({ children }: { children: string }) {
  return (
    <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-[0.85em] text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
      {children}
    </code>
  );
}

export default function Docs() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-lg font-semibold">
          Allowance
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Sign in
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="pt-8 text-4xl font-semibold tracking-tight">Quickstart</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Allowance is a prepaid proxy for any pay-per-use API. You load a
          balance, route your traffic through one key, and it stops at zero.
          Here is the whole thing in three steps.
        </p>

        <Section title="1. Connect a service">
          <p>
            In the{" "}
            <Link href="/dashboard" className="text-emerald-600 hover:underline dark:text-emerald-400">
              dashboard
            </Link>
            , add the API you want to put a budget on: its base URL and the auth
            header it normally needs. For example, name <Mono>OpenAI</Mono>, URL{" "}
            <Mono>https://api.openai.com/v1</Mono>, header{" "}
            <Mono>Authorization: Bearer sk-...</Mono>.
          </p>
          <p>
            Those credentials are encrypted in a vault. We never store or log
            them in plain text.
          </p>
        </Section>

        <Section title="2. Create a key">
          <p>
            Click <strong>Create proxy key</strong> on the service. You get one
            key, shown a single time, like <Mono>alw_live_…</Mono>. This is what
            your app or agent sends, in place of your real API key.
          </p>
        </Section>

        <Section title="3. Point your base URL at the proxy">
          <p>
            Keep your code exactly the same. Swap the API host for the Allowance
            proxy and use your <Mono>alw_live_</Mono> key. Everything after{" "}
            <Mono>/v1/proxy</Mono> is forwarded to your service.
          </p>
          <Code>{`# Before
curl https://api.openai.com/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-real-key" ...

# After
curl ${PROXY}/v1/proxy/chat/completions \\
  -H "Authorization: Bearer alw_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{ "model": "gpt-4o-mini", "messages": [{"role":"user","content":"hi"}] }'`}</Code>
          <p>
            Allowance removes your <Mono>alw_</Mono> key, adds your real
            credentials, forwards the call, streams the response back, and
            subtracts the cost from your balance.
          </p>
        </Section>

        <Section title="Streaming works out of the box">
          <p>
            Live token streams pass straight through. Add{" "}
            <Mono>{`"stream": true`}</Mono> and read the response exactly as you
            would from the service directly.
          </p>
        </Section>

        <Section title="When the balance runs out">
          <p>
            At zero, the proxy stops the request and returns{" "}
            <Mono>402 Payment Required</Mono> with a small JSON body. No
            overdraft, no surprise bill.
          </p>
          <Code>{`HTTP/1.1 402 Payment Required

{ "x402Version": 1, "error": "PAYMENT_REQUIRED",
  "accepts": [{ "scheme": "prepaid", "maxAmountRequired": 0.01,
                "balanceRemaining": 0 }] }`}</Code>
        </Section>

        <Section title="Funding your balance">
          <p>
            <strong>People</strong> top up by card in the dashboard.{" "}
            <strong>Agents</strong> top up programmatically with USDC over x402,
            with no card and no human needed:
          </p>
          <Code>{`# An agent tops itself up $5 in USDC.
# With no payment attached, this returns 402 + payment details.
# An x402 client (such as x402-fetch) signs and retries automatically.
POST ${PROXY}/v1/topup/5
Authorization: Bearer alw_live_your_key`}</Code>
          <p>Top-up amounts: $5, $10, $25, $50, $100.</p>
        </Section>

        <Section title="Revoke a leaked key">
          <p>
            Click <strong>Revoke</strong> in the dashboard. The key stops working
            at the edge within seconds and every further request returns{" "}
            <Mono>401</Mono>. You can disable a whole service the same way.
          </p>
        </Section>

        <div className="border-t border-neutral-200 pt-10 dark:border-neutral-800">
          <Link
            href="/login"
            className="inline-block rounded-md bg-neutral-900 px-5 py-3 font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Get started free
          </Link>
        </div>
      </main>
    </div>
  );
}
