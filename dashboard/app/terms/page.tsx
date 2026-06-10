import { SiteNav } from "@/components/site-nav";

export const metadata = {
  title: "Terms of Service | Allowance",
};

function H2({ children }: { children: string }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight">{children}</h2>;
}

export default function Terms() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-[var(--text-faint)]">
          Last updated: June 9, 2026
        </p>

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[var(--text-muted)]">
          <p>
            Allowance (&ldquo;the Service&rdquo;) is a spend-control gateway for
            APIs you already pay for. You route your traffic through Allowance,
            and we apply the budgets and limits you configure. By using the
            Service you agree to these terms.
          </p>

          <H2>1. Your providers, your bills</H2>
          <p>
            Allowance is &ldquo;bring your own key&rdquo;. You remain solely
            responsible for your own accounts with third-party API providers (such
            as OpenAI or Anthropic), for the keys you add, and for every charge
            those providers bill you. Allowance does not pay your providers and is
            not a party to your relationship with them.
          </p>

          <H2>2. Budgets are best-effort</H2>
          <p>
            The budget cap, per-key and per-project limits stop requests at the
            network edge based on the cost estimates you configure. For flat-rate
            connections those estimates are values you choose and may not exactly
            match a provider&rsquo;s real billing. The Service is provided to help
            you control spend, not to guarantee a precise spend figure.
          </p>

          <H2>3. Acceptable use</H2>
          <p>
            You may not use the Service for unlawful activity, to route traffic
            you are not authorized to send, or to attempt to disrupt, reverse
            engineer, or abuse the Service or other users. We may suspend or
            terminate accounts that violate these terms.
          </p>

          <H2>4. Billing and fair use</H2>
          <p>
            Paid plans are billed monthly through our merchant of record, Polar
            (Polar Software Inc.), which is the seller of record and handles
            payment processing and applicable taxes. You can cancel at any time
            from the billing portal; access continues until the end of the paid
            period. Fees already paid are non-refundable except where required
            by law.
          </p>
          <p>
            The Pro plan has no fixed monthly request cap, subject to fair use:
            sustained volumes beyond roughly one million requests per month may
            require an Enterprise arrangement. We will always contact you before
            limiting anything.
          </p>

          <H2>5. Availability and warranty</H2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo;, without warranties of any kind. We do not guarantee
            uninterrupted or error-free operation. You are responsible for how you
            integrate the Service into systems you operate.
          </p>

          <H2>6. Limitation of liability</H2>
          <p>
            To the maximum extent permitted by law, Allowance is not liable for
            indirect, incidental, or consequential damages, for provider charges
            you incur, for lost revenue, or for downtime. Our total liability is
            limited to the fees you paid us in the three months before the claim.
          </p>

          <H2>7. Changes</H2>
          <p>
            We may update these terms. Material changes will be reflected by the
            date above. Continued use after a change means you accept it.
          </p>

          <H2>8. Contact</H2>
          <p>
            Questions about these terms: open an issue at{" "}
            <a
              href="https://github.com/9atar6/allowance/issues"
              className="text-[var(--accent)] hover:underline"
            >
              github.com/9atar6/allowance
            </a>
            . A support inbox is coming with general availability.
          </p>
        </div>
      </main>
    </div>
  );
}
