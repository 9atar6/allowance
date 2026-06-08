import Link from "next/link";

export const metadata = {
  title: "Docs — Allowance",
  description: "Quickstart: route any API through Allowance in three steps.",
};

const PROXY = "https://api-wallet-proxy.6rataq.workers.dev";

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4 text-sm leading-relaxed text-neutral-300">
      <code>{children}</code>
    </pre>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-neutral-900 py-10">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-400">
        {children}
      </div>
    </section>
  );
}

export default function Docs() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-lg font-semibold text-white">
          Allowance
        </Link>
        <Link
          href="/login"
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="pt-8 text-4xl font-semibold tracking-tight text-white">
          Quickstart
        </h1>
        <p className="mt-4 text-neutral-400">
          Allowance is a prepaid proxy for any pay-per-use API. You load a
          balance, route your traffic through one key, and it stops at zero. Here
          is the whole thing in three steps.
        </p>

        <Section id="add-endpoint" title="1. Add an endpoint">
          <p>
            In the <Link href="/dashboard" className="text-emerald-400 hover:underline">dashboard</Link>,
            add the API you want to proxy: its base URL and the auth headers it
            normally needs. For example, name <code>OpenAI</code>, URL{" "}
            <code>https://api.openai.com/v1</code>, header{" "}
            <code>Authorization: Bearer sk-...</code>.
          </p>
          <p>
            Those credentials are encrypted in Supabase Vault. We never store or
            log them in plaintext.
          </p>
        </Section>

        <Section id="get-key" title="2. Mint a key">
          <p>
            Click <strong>Create proxy key</strong> on the endpoint. You get one
            key, shown once, like <code>alw_live_…</code>. This is what your app
            or agent sends, in place of your real API key.
          </p>
        </Section>

        <Section id="route" title="3. Point your base URL at the proxy">
          <p>
            Keep your code the same. Swap the API host for the Allowance proxy
            and use your <code>alw_live_</code> key. The path after{" "}
            <code>/v1/proxy</code> is forwarded to your endpoint.
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
            Allowance strips your <code>alw_</code> key, injects your real
            credentials, forwards the call, streams the response back, and
            deducts the cost.
          </p>
        </Section>

        <Section id="streaming" title="Streaming works out of the box">
          <p>
            Server-sent event streams pass straight through, byte for byte. Add{" "}
            <code>{`"stream": true`}</code> and read the stream exactly as you
            would from the upstream API.
          </p>
        </Section>

        <Section id="402" title="When the balance runs out">
          <p>
            At zero, the proxy stops the request and returns{" "}
            <code>HTTP 402 Payment Required</code> with an x402-style body. No
            overdraft, no surprise bill.
          </p>
          <Code>{`HTTP/1.1 402 Payment Required

{ "x402Version": 1, "error": "PAYMENT_REQUIRED",
  "accepts": [{ "scheme": "prepaid", "maxAmountRequired": 0.01,
                "balanceRemaining": 0 }] }`}</Code>
        </Section>

        <Section id="funding" title="Funding your balance">
          <p>
            <strong>People</strong> top up by card in the dashboard.{" "}
            <strong>Agents</strong> top up programmatically with USDC over x402,
            no card and no human needed:
          </p>
          <Code>{`# Agent self-tops-up $5 in USDC.
# With no payment, this returns 402 + payment requirements.
# An x402 client (e.g. x402-fetch) signs and retries automatically.
POST ${PROXY}/v1/topup/5
Authorization: Bearer alw_live_your_key`}</Code>
          <p>Top-up tiers: $5, $10, $25, $50, $100.</p>
        </Section>

        <Section id="revoke" title="Revoke a leaked key">
          <p>
            Click <strong>Revoke</strong> in the dashboard. The key is evicted at
            the edge within seconds and every further request returns{" "}
            <code>401</code>. Disable a whole endpoint the same way.
          </p>
        </Section>

        <div className="border-t border-neutral-900 pt-10">
          <Link
            href="/login"
            className="inline-block rounded-md bg-white px-5 py-3 font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Get started free
          </Link>
        </div>
      </main>
    </div>
  );
}
