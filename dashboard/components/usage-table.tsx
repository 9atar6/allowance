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
    return <p className="text-sm text-neutral-500">No requests yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-neutral-500">
          <th className="pb-2 font-normal">When</th>
          <th className="pb-2 font-normal">Endpoint</th>
          <th className="pb-2 text-right font-normal">Status</th>
          <th className="pb-2 text-right font-normal">Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-neutral-800">
            <td className="py-2 text-neutral-400">{formatTimestamp(r.createdAt)}</td>
            <td className="py-2 text-neutral-300">{endpointName(r.endpointId)}</td>
            <td className="py-2 text-right tabular-nums text-neutral-400">
              {r.statusCode ?? "—"}
            </td>
            <td className="py-2 text-right tabular-nums text-neutral-200">
              {formatUsd(r.cost)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
