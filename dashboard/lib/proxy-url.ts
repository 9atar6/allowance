// The proxy host, shared by docs/landing/onboarding so it can never drift.
// Server-side only (RSC + server actions), so the env override is read at
// runtime: E2E points it at the staging worker without a rebuild.
export const PROXY_URL =
  process.env.PROXY_URL ?? "https://api.getallowance.dev";
