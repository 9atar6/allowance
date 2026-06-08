import { formatSignedUsd, formatTimestamp, formatUsd } from "@/lib/format";

export interface TxnRow {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

export function TransactionsTable({ rows }: { rows: TxnRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">No transactions yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-neutral-500">
          <th className="pb-2 font-normal">When</th>
          <th className="pb-2 font-normal">Type</th>
          <th className="pb-2 text-right font-normal">Amount</th>
          <th className="pb-2 text-right font-normal">Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-neutral-800">
            <td className="py-2 text-neutral-400">{formatTimestamp(r.createdAt)}</td>
            <td className="py-2 capitalize text-neutral-300">{r.type}</td>
            <td
              className={`py-2 text-right tabular-nums ${
                r.amount >= 0 ? "text-green-400" : "text-neutral-300"
              }`}
            >
              {formatSignedUsd(r.amount)}
            </td>
            <td className="py-2 text-right tabular-nums text-neutral-400">
              {formatUsd(r.balanceAfter)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
