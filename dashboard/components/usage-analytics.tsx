import { formatUsd } from "@/lib/format";

export interface DailyPoint {
  day: string;
  requests: number;
  cost: number;
}
export interface ServicePoint {
  endpointId: string | null;
  requests: number;
  cost: number;
}

interface Props {
  daily: DailyPoint[];
  services: ServicePoint[];
  serviceName: (id: string | null) => string;
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function UsageAnalytics({ daily, services, serviceName }: Props) {
  const totalCost = daily.reduce((s, d) => s + d.cost, 0);
  const totalReq = daily.reduce((s, d) => s + d.requests, 0);
  const max = Math.max(...daily.map((d) => d.cost), 1e-9);

  return (
    <div>
      <div className="flex gap-10">
        <div>
          <p className="text-xs text-[var(--text-faint)]">Spent · 14 days</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatUsd(totalCost)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-faint)]">Requests · 14 days</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {totalReq.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Daily spend bars */}
      <div className="mt-7 flex h-28 items-end gap-1.5">
        {daily.map((d) => {
          const h = Math.max(2, Math.round((d.cost / max) * 100));
          return (
            <div
              key={d.day}
              className="flex h-full flex-1 items-end"
              title={`${fmtDay(d.day)} · ${d.requests} req · ${formatUsd(d.cost)}`}
            >
              <div
                className="w-full rounded-[3px] bg-[var(--accent)]"
                style={{ height: `${h}%`, opacity: d.cost > 0 ? 1 : 0.2 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-[var(--text-faint)]">
        <span>{daily.length ? fmtDay(daily[0].day) : ""}</span>
        <span>{daily.length ? fmtDay(daily[daily.length - 1].day) : ""}</span>
      </div>

      {/* Top services */}
      {services.length > 0 && (
        <div className="mt-7 border-t border-[var(--line)] pt-5">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Top services · 30 days
          </p>
          <ul className="space-y-1.5 text-sm">
            {services.slice(0, 5).map((s) => (
              <li
                key={s.endpointId ?? "unknown"}
                className="flex items-center justify-between"
              >
                <span className="text-[var(--text)]">
                  {serviceName(s.endpointId)}
                </span>
                <span className="tabular-nums text-[var(--text-muted)]">
                  {s.requests.toLocaleString()} req · {formatUsd(s.cost)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
