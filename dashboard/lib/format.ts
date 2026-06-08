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

/** Signed USD for ledger rows: "+$5.00" credit, "-$0.01" debit. */
export function formatSignedUsd(amount: number): string {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${formatUsd(Math.abs(amount))}`;
}
