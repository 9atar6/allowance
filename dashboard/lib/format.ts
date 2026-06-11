// Pure display formatters — framework-free + deterministic so they're testable.

/** USD with 2–6 fraction digits (sub-cent precision for per-call costs). */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);
}

/** ISO timestamp → "YYYY-MM-DD HH:MM UTC". Returns "—" for invalid input. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * ISO timestamp → "Jun 11". Fixed locale + UTC so the server and every
 * browser render the same text (locale-dependent output breaks hydration).
 */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Integer with en-US thousands separators ("5,000"), hydration-safe. */
export function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

/** Signed USD for ledger rows: "+$5.00" credit, "-$0.01" debit. */
export function formatSignedUsd(amount: number): string {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${formatUsd(Math.abs(amount))}`;
}
