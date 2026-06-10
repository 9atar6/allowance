import Link from "next/link";
import { CodeBlock } from "@/components/marketing/code-block";
import { SiteNav } from "@/components/site-nav";

export const metadata = {
  title: "Allowance Docs",
  description: "Quickstart: route any API through Allowance in three steps.",
};

// The live proxy host.
const PROXY = "https://api.getallowance.dev";

const toc = [
  { id: "connect", label: "1. Connect a service" },
  { id: "key", label: "2. Create a key" },
  { id: "route", label: "3. Point your base URL" },
  { id: "providers", label: "Provider quickstarts" },
  { id: "streaming", label: "Streaming" },
  { id: "limits", label: "The four caps" },
  { id: "limit", label: "When the budget runs out" },
  { id: "budget", label: "Setting a budget" },
  { id: "revoke", label: "Revoke a key" },
  { id: "errors", label: "Error reference" },
  { id: "faq", label: "FAQ" },
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
      <SiteNav />

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
                  className="block py-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
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
              Allowance is a spend-control proxy for any pay-per-use API. You set
              a budget, route your traffic through one key, and it stops at your
              cap. Your providers still bill you directly, we never touch that
              money. Here is the whole thing in three steps.
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
                  Click <strong className="text-[var(--text)]">Create proxy key</strong> on
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
                  credentials, forwards the call, and streams the response back.
                  Your provider bills you as usual, we just count the estimated
                  cost against your free budget and stop you at your cap.
                </p>
              </Step>

              <Step id="providers" title="Provider quickstarts">
                <p>
                  Official SDKs work unchanged, point the base URL at your
                  Allowance slug and pass your <Mono>alw_live_</Mono> key as the
                  API key. Your real provider key stays in the vault.
                </p>
                <CodeBlock
                  label="openai (js / python)"
                  code={`// JavaScript
import OpenAI from "openai";
const client = new OpenAI({
  apiKey: "alw_live_your_key",
  baseURL: "${PROXY}/v1/proxy/openai",
});

# Python
from openai import OpenAI
client = OpenAI(
    api_key="alw_live_your_key",
    base_url="${PROXY}/v1/proxy/openai",
)`}
                />
                <CodeBlock
                  label="anthropic (js / python)"
                  code={`// JavaScript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({
  apiKey: "alw_live_your_key",
  baseURL: "${PROXY}/v1/proxy/anthropic",
});

# Python
from anthropic import Anthropic
client = Anthropic(
    api_key="alw_live_your_key",
    base_url="${PROXY}/v1/proxy/anthropic",
)`}
                />
                <CodeBlock
                  label="gemini (rest)"
                  code={`# Gemini's SDK pins its host, so call the REST API through your slug:
curl "${PROXY}/v1/proxy/gemini/models/gemini-1.5-flash:generateContent" \\
  -H "Authorization: Bearer alw_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{ "contents": [{ "parts": [{ "text": "hi" }] }] }'`}
                />
                <p>
                  The slug (<Mono>openai</Mono>, <Mono>anthropic</Mono>, …) is
                  whatever you chose when attaching the connection to your
                  project.
                </p>
              </Step>

              <Step id="streaming" title="Streaming works out of the box">
                <p>
                  Live token streams pass straight through. Add{" "}
                  <Mono>{`"stream": true`}</Mono> and read the response exactly as
                  you would from the service directly.
                </p>
              </Step>

              <Step id="limits" title="The four caps">
                <p>
                  Allowance enforces four independent hard stops. Any one of them
                  tripping returns <Mono>402</Mono> and the call never reaches
                  your provider:
                </p>
                <ul className="ml-5 list-disc space-y-2">
                  <li>
                    <strong className="text-[var(--text)]">Account budget</strong>: the
                    number on your dashboard. The ultimate ceiling across
                    everything you run.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">Project budget /mo</strong> -
                    optional, set when creating a project. Caps all keys in that
                    project combined, resets monthly.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">Key cap /day</strong> -
                    optional, set when minting a key. Resets at midnight UTC.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">Key cap /mo</strong> -
                    optional, set when minting a key. Resets monthly.
                  </li>
                </ul>
                <p>
                  Typical setup: a generous account budget, a sane project
                  budget, and a tight daily cap on any key an autonomous agent
                  holds.
                </p>
              </Step>

              <Step id="limit" title="When the budget runs out">
                <p>
                  At your cap, the proxy stops the request and returns{" "}
                  <Mono>402 Payment Required</Mono> with a small JSON body, a
                  hard stop, so a runaway agent can never blow past your limit.
                </p>
                <CodeBlock
                  label="402 response"
                  code={`{
  "x402Version": 1,
  "error": "PAYMENT_REQUIRED",
  "message": "Allowance budget is exhausted for this key.",
  "accepts": [
    {
      "scheme": "budget",
      "maxAmountRequired": 0.01,
      "budgetRemaining": 0,
      "payTo": "https://getallowance.dev/dashboard"
    }
  ]
}`}
                />
              </Step>

              <Step id="budget" title="Setting a budget">
                <p>
                  Open the dashboard and set a budget, it is{" "}
                  <strong className="text-[var(--text)]">free</strong>, just a cap.
                  Allowance never charges you and never pays your providers; they
                  bill you directly as usual. The budget only decides when your
                  apps and agents get cut off.
                </p>
                <p>
                  Give each connection a <Mono>cost per call</Mono> (or pick a
                  provider preset for real per-token pricing). That is only an
                  estimate we use to count the budget down, so the cap trips near
                  what you are actually spending with your provider. Set caps per
                  project and per key for finer control.
                </p>
              </Step>

              <Step id="revoke" title="Revoke a leaked key">
                <p>
                  Click <strong className="text-[var(--text)]">Revoke</strong> in the
                  dashboard. The key stops working at the edge within seconds and
                  every further request returns <Mono>401</Mono>. You can disable a
                  whole service the same way.
                </p>
              </Step>

              <Step id="errors" title="Error reference">
                <p>
                  Every error is JSON with an <Mono>error</Mono> field. The exact
                  values:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[var(--text-faint)]">
                        <th className="pb-2 pr-4 font-normal">Status</th>
                        <th className="pb-2 pr-4 font-normal">error</th>
                        <th className="pb-2 font-normal">Meaning / fix</th>
                      </tr>
                    </thead>
                    <tbody className="align-top">
                      {[
                        ["401", "missing_api_key", "No Authorization header. Send Bearer alw_live_…"],
                        ["401", "invalid_api_key", "Unknown or revoked key. Mint a new one."],
                        ["402", "x402 body", "Account budget exhausted. Raise it on the dashboard."],
                        ["402", "daily_limit_reached", "This key's $/day cap tripped. Resets midnight UTC."],
                        ["402", "monthly_limit_reached", "This key's $/month cap tripped. Resets monthly."],
                        ["402", "project_budget_reached", "The project's monthly budget tripped."],
                        ["404", "unknown_service", "The slug after /v1/proxy/ doesn't match an attached service."],
                        ["413", "payload_too_large", "Request body over 10 MB."],
                        ["429", "rate_limited", "Too many requests (per key or per IP). Back off and retry."],
                        ["502", "upstream_unreachable", "Your provider's URL is down or wrong."],
                        ["503", "endpoint_unavailable", "The connection is disabled. Re-enable it."],
                        ["504", "upstream_timeout", "Provider didn't respond within 60 s."],
                      ].map(([status, err, fix]) => (
                        <tr key={`${status}-${err}`} className="border-t border-[var(--line)]">
                          <td className="py-2 pr-4 font-mono text-xs">{status}</td>
                          <td className="py-2 pr-4 font-mono text-xs text-[var(--accent)]">
                            {err}
                          </td>
                          <td className="py-2 text-xs text-[var(--text-muted)]">{fix}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Step>

              <Step id="faq" title="FAQ">
                <div className="space-y-5">
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      Does Allowance charge me for my API usage?
                    </p>
                    <p className="mt-1">
                      No. Your providers bill you directly, exactly as before.
                      The budget is a free cap; Allowance only charges for the
                      Pro plan if you choose it.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      Can you see my prompts or responses?
                    </p>
                    <p className="mt-1">
                      No. Bodies stream through and are never stored or logged.
                      We keep metadata only: timestamps, status codes, token
                      counts, estimated cost.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      How exact is the budget?
                    </p>
                    <p className="mt-1">
                      Per-token presets (OpenAI, Anthropic, Gemini) compute real
                      token cost from each response. Flat-rate connections use
                      the estimate you set. Treat the budget as a guardrail, not
                      an invoice.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      What happens to in-flight streams when a cap trips?
                    </p>
                    <p className="mt-1">
                      Caps are checked before each call. A stream that already
                      started always finishes; the next call gets the 402.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      How fast is revocation?
                    </p>
                    <p className="mt-1">
                      Within seconds, and never more than 60 (the edge cache
                      TTL).
                    </p>
                  </div>
                </div>
              </Step>
            </div>

            <div className="mt-16 border-t border-[var(--line)] pt-10">
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
