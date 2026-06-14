# Security Policy

Allowance is a spend-control gateway: users route API traffic through it with
their own provider keys. We treat the confidentiality of those keys as the
product's reason to exist. The full security model, with links to the relevant
code, is published at https://getallowance.dev/security.

## Reporting a vulnerability

Please report vulnerabilities privately via
[GitHub security advisories](https://github.com/9atar6/allowance/security/advisories/new)
or email <support@getallowance.dev>. Do not open a public issue for security
reports.

- We aim to acknowledge reports within 48 hours.
- We will keep you informed while we investigate and fix.
- No bounty program yet; researchers are credited in the changelog unless they
  prefer otherwise.

## Scope

- The proxy (`proxy/`), dashboard (`dashboard/`), and database schema (`db/`).
- The live deployments at `getallowance.dev` and `api.getallowance.dev`.

Out of scope: denial-of-service volumetrics, social engineering, and issues in
third-party providers (Cloudflare, Supabase, Polar, Resend) without an
Allowance-specific exploitation path.

## Key facts for reviewers

- Provider keys: Supabase Vault at rest, AES-256-GCM re-encryption in the edge
  cache, in-memory decryption only at forward time, never logged.
- Allowance keys: stored as SHA-256 hashes only; shown once at mint.
- Logging: no request/response bodies, prompts, completions, or headers are
  ever logged (`proxy/src/lib/log.ts`).
- Database: RLS deny-by-default; the edge worker runs with a restricted role
  limited to four RPCs.
