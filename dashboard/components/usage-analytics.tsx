"use client";

import { useState } from "react";
import { formatInt, formatShortDate, formatUsd } from "@/lib/format";

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
  /** endpointId -> display name, resolved server-side. */
  serviceNames: Record<string, string>;
}

type Metric = "cost" | "requests";

const fmtDay = formatShortDate;

export function UsageAnalytics({ daily, services, serviceNames }: Props) {
  const [metric, setMetric] = useState<Metric>("cost");

  const totalCost = daily.reduce((s, d) => s + d.cost, 0);
  const totalReq = daily.reduce((s, d) => s + d.requests, 0);
  const value = (d: DailyPoint) => (metric === "cost" ? d.cost : d.requests);
  const max = Math.max(...daily.map(value), 1e-9);
  const name = (id: string | null) => (id && serviceNames[id]) || "Unknown";

  function StatButton({ m, label, display }: { m: Metric; label: string; display: string }) {
    const active = metric === m;
    return (
      <button
        type="button"
        onClick={() => setMetric(m)}
        aria-pressed={active}
        className={`px-3 py-2 text-left transition-shadow ${
          active ? "neu-inset-sm" : "pressable rounded-[var(--r-sm)]"
        }`}
      >
        <span className="block text-xs text-[var(--text-faint)]">{label}</span>
        <span className="mt-0.5 block text-2xl font-semibold tabular-nums text-[var(--text)]">
          {display}
        </span>
      </button>
    );
  }

  return (
    <div>
      {/* Totals double as the chart-metric toggle */}
      <div className="flex gap-4">
        <StatButton m="cost" label="Spent · 14 days" display={formatUsd(totalCost)} />
        <StatButton m="requests" label="Requests · 14 days" display={formatInt(totalReq)} />
      </div>

      {/* Daily bars for the selected metric */}
      <div className="mt-6 flex h-28 items-end gap-1.5">
        {daily.map((d) => {
          const v = value(d);
          const h = Math.max(2, Math.round((v / max) * 100));
          return (
            <div
              key={d.day}
              className="flex h-full flex-1 items-end"
              title={`${fmtDay(d.day)} · ${d.requests} req · ${formatUsd(d.cost)}`}
            >
              <div
                className="w-full rounded-[3px] bg-[var(--accent)]"
                style={{ height: `${h}%`, opacity: v > 0 ? 1 : 0.2 }}
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
                <span className="text-[var(--text)]">{name(s.endpointId)}</span>
                <span className="tabular-nums text-[var(--text-muted)]">
                  {formatInt(s.requests)} req · {formatUsd(s.cost)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
