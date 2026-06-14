import { SiteNav } from "@/components/site-nav";

export const metadata = {
  title: "Security | Allowance",
  description:
    "How Allowance protects your API keys: vault encryption, hashed proxy keys, zero content logging, and an open-source codebase you can verify.",
};

function H2({ children }: { children: string }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight">{children}</h2>;
}

function Claim({
  title,
  children,
  verify,
}: {
  title: string;
  children: React.ReactNode;
  verify?: string;
}) {
  return (
    <div className="neu-inset p-5">
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
        {children}
      </p>
      {verify && (
        <a
          href={verify}
          className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline"
        >
          Verify in the source →
        </a>
      )}
    </div>
  );
}

const REPO = "https://github.com/9atar6/allowance";

export default function Security() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl">Security</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--text-muted)]">
          You are trusting us with API keys, so this page does not do marketing.
          Every claim below is implemented in our open-source code, with a link
          so you can check it yourself instead of taking our word.
        </p>

        <div className="mt-8 grid gap-4">
          <Claim
            title="Your provider keys are vaulted, not stored as text"
            verify={`${REPO}/blob/main/db/schema.sql`}
          >
            The API keys you connect are encrypted in a Postgres secrets vault
            (Supabase Vault, AES). When the edge proxy caches a route, the
            credential is re-encrypted with a separate AES-256-GCM key that only
            the proxy holds. It is decrypted in memory for the milliseconds a
            request is being forwarded, then discarded. There is no code path
            that returns your key to a browser, a log, or an API response.
          </Claim>

          <Claim
            title="Your Allowance keys exist only as hashes"
            verify={`${REPO}/blob/main/dashboard/lib/keys.ts`}
          >
            An alw_live_ key is shown to you once, at mint time. What we store
            is its SHA-256 hash. If our database leaked, the attacker would hold
            hashes that cannot be turned back into working keys.
          </Claim>

          <Claim
            title="Zero content logging"
            verify={`${REPO}/blob/main/proxy/src/lib/log.ts`}
          >
            The proxy never logs request or response bodies, prompts,
            completions, or headers. What we meter per request: a timestamp, a
            status code, token counts, an estimated cost, and a duration. That
            is the entire list, and the logging module is small enough to read
            in two minutes.
          </Claim>

          <Claim
            title="Caps fail closed"
            verify={`${REPO}/blob/main/proxy/src/index.ts`}
          >
            Budget checks run before your request is forwarded. At zero, calls
            stop with HTTP 402. A revoked key dies globally within seconds (we
            purge the edge cache on revocation; the cache window is at most 60
            seconds if the purge cannot reach an edge).
          </Claim>

          <Claim
            title="Least-privilege everywhere"
            verify={`${REPO}/blob/main/db/schema.sql`}
          >
            The database denies all access by default (row-level security); you
            can only ever read your own rows. The edge proxy itself does not
            hold an admin credential: it runs with a restricted role that can
            execute exactly four database functions and touch nothing else.
          </Claim>

          <Claim
            title="Zero-downtime key rotation"
            verify={`${REPO}/blob/main/dashboard/app/dashboard/actions.ts`}
          >
            Rotate any key in one click: a fresh key is minted with the same
            caps and the old one keeps working for 24 hours while you update
            your configs, then dies automatically.
          </Claim>

          <Claim title="Open source, so none of this is a promise" verify={REPO}>
            The entire codebase (proxy, dashboard, database schema) is public.
            The fastest way to trust an infrastructure product is to read it.
          </Claim>
        </div>

        <div className="mt-10 space-y-4 text-[15px] leading-relaxed text-[var(--text-muted)]">
          <H2>Honest limits</H2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              Budget enforcement at the edge works on cached snapshots refreshed
              at most every 60 seconds; the database settlement is
              authoritative. In a worst case, a burst can overshoot a cap by a
              few calls before the snapshot catches up.
            </li>
            <li>
              We are a small team. We publish our{" "}
              <a
                href="https://stats.uptimerobot.com/bewvMY4MqN"
                className="text-[var(--accent)] hover:underline"
              >
                live status page
              </a>{" "}
              and run automated error alerting, but we do not yet hold a SOC 2
              attestation.
            </li>
            <li>
              Your traffic transits Cloudflare (proxy), and metadata is stored
              on Supabase (Postgres). Both are SOC 2 / ISO 27001 certified
              providers.
            </li>
          </ul>

          <H2>Reporting a vulnerability</H2>
          <p>
            Found something? Please report it privately via{" "}
            <a
              href="https://github.com/9atar6/allowance/security/advisories/new"
              className="text-[var(--accent)] hover:underline"
            >
              GitHub security advisories
            </a>{" "}
            or email{" "}
            <a
              href="mailto:support@getallowance.dev"
              className="text-[var(--accent)] hover:underline"
            >
              support@getallowance.dev
            </a>
            . We aim to acknowledge within 48 hours. No bounty program yet, but
            researchers are credited in the changelog.
          </p>
        </div>
      </main>
    </div>
  );
}
