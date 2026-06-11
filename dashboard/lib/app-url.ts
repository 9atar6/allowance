// Canonical app origin for redirects (magic links, OAuth, checkout returns).
// Falls back to the real production domain, never localhost: a missing env var
// must not strand a user (or a paying customer) on a dead redirect.
export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://getallowance.dev"
      : "http://localhost:3000")
  );
}
