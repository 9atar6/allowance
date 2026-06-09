import { formatTimestamp, formatUsd } from "@/lib/format";

export interface UsageRow {
  id: string;
  endpointId: string | null;
  cost: number;
  statusCode: number | null;
  createdAt: string;
}

interface Props {
  rows: UsageRow[];
  endpointName: (id: string | null) => string;
}

export function UsageTable({ rows, endpointName }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-faint)]">No requests yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-[var(--text-faint)]">
          <th className="pb-2 font-normal">When</th>
          <th className="pb-2 font-normal">Endpoint</th>
          <th className="pb-2 text-right font-normal">Status</th>
          <th className="pb-2 text-right font-normal">Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/5">
            <td className="py-2 text-[var(--text-muted)]">
              {formatTimestamp(r.createdAt)}
            </td>
            <td className="py-2 text-[var(--text)]">
              {endpointName(r.endpointId)}
            </td>
            <td className="py-2 text-right font-mono tabular-nums text-[var(--text-muted)]">
              {r.statusCode ?? "-"}
            </td>
            <td className="py-2 text-right tabular-nums text-[var(--text)]">
              {formatUsd(r.cost)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
