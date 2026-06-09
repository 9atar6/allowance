import { SiteNav } from "@/components/site-nav";

export const metadata = {
  title: "Privacy Policy — Allowance",
};

function H2({ children }: { children: string }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight">{children}</h2>;
}

export default function Privacy() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-[var(--text-faint)]">
          Last updated: June 9, 2026
        </p>

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[var(--text-muted)]">
          <p>
            This policy explains what Allowance stores, how we protect it, and who
            we share it with. We aim to collect as little as possible.
          </p>

          <H2>What we store</H2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>Account:</strong> your email address, via our auth provider
              (Supabase). We never see your password.
            </li>
            <li>
              <strong>Configuration:</strong> your projects, connections (the API
              base URLs you add), budgets, and proxy keys (stored only as a hash —
              the full key is shown once and never stored).
            </li>
            <li>
              <strong>Provider credentials:</strong> the API keys you add are
              encrypted in a secrets vault and re-encrypted at the network edge.
              They are used only to forward your own requests and are never
              written to a log in plaintext.
            </li>
            <li>
              <strong>Usage metadata:</strong> timestamps, status codes, token
              counts, and estimated cost per request. We do{" "}
              <strong>not</strong> store request or response bodies, prompts, or
              completions.
            </li>
          </ul>

          <H2>How we protect it</H2>
          <p>
            Credentials are encrypted at rest and in our edge cache with
            AES-256-GCM, decrypted only in memory for the moment a request is
            forwarded. Database access is row-level isolated so you can only ever
            read your own data.
          </p>

          <H2>Who we share with</H2>
          <p>
            We use a small set of infrastructure providers to run the Service:
            Supabase (database and authentication), Cloudflare (the edge proxy),
            Stripe (payments — we never see or store your card details), Resend
            (transactional email), and Vercel (hosting). We do not sell your data
            or share it for advertising.
          </p>

          <H2>Cookies</H2>
          <p>
            We use a single authentication cookie to keep you signed in. No
            third-party tracking or advertising cookies.
          </p>

          <H2>Your data</H2>
          <p>
            You can delete a connection, project, or key at any time from the
            dashboard. To delete your account and all associated data, email us
            and we will remove it.
          </p>

          <H2>Contact</H2>
          <p>
            Privacy questions or deletion requests:{" "}
            <strong>support@allowance.dev</strong>.
          </p>
        </div>
      </main>
    </div>
  );
}
