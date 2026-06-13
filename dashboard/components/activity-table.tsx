import { formatSignedUsd, formatTimestamp, formatUsd } from "@/lib/format";

export interface ActivityRow {
  id: string;
  createdAt: string;
  /** Endpoint name for a request, or "Top-up" for a credit. */
  label: string;
  status: number | null;
  amount: number; // signed: + credit, - debit
  balanceAfter: number;
}

/**
 * One chronological ledger of everything that moved the balance, top-ups and
 * per-request charges in a single feed. Replaces the old split usage/txn tables.
 */
export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-faint)]">No activity yet.</p>;
  }

  return (
    <table className="w-full min-w-[560px] text-sm">
      <thead className="sticky top-0 bg-[var(--bg)]">
        <tr className="text-left text-xs text-[var(--text-faint)]">
          <th className="pb-3 pt-1 font-normal">When</th>
          <th className="pb-3 pt-1 font-normal">Activity</th>
          <th className="pb-3 pt-1 text-right font-normal">Status</th>
          <th className="pb-3 pt-1 text-right font-normal">Amount</th>
          <th className="pb-3 pt-1 text-right font-normal">Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const credit = r.amount >= 0;
          return (
            <tr key={r.id} className="border-t border-[var(--line)]">
              <td className="py-2.5 text-[var(--text-muted)]">
                {formatTimestamp(r.createdAt)}
              </td>
              <td className="py-2.5">
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      credit ? "bg-[var(--accent)]" : "bg-[var(--text-faint)]"
                    }`}
                  />
                  {r.label}
                </span>
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums text-[var(--text-faint)]">
                {r.status ?? "-"}
              </td>
              <td
                className={`py-2.5 text-right font-mono tabular-nums ${
                  credit ? "text-[var(--accent)]" : "text-[var(--text)]"
                }`}
              >
                {formatSignedUsd(r.amount)}
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums text-[var(--text-muted)]">
                {formatUsd(r.balanceAfter)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
