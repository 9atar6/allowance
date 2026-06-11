"use client";

import { useState, useTransition } from "react";
import {
  openBillingPortal,
  startProCheckout,
  type SubResult,
} from "@/app/dashboard/billing-actions";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { formatInt, formatShortDate } from "@/lib/format";
import {
  FREE_MONTHLY_REQUESTS,
  PRO_PRICE_USD,
  planLabel,
  type PlanTier,
} from "@/lib/plans";

interface Props {
  plan: PlanTier;
  used: number;
  limit: number | null;
  periodEnd?: string | null;
}

/** The "Plan" half of the account card. Fills its column; action pinned bottom. */
export function PlanCard({ plan, used, limit, periodEnd }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go(action: () => Promise<SubResult>) {
    setError(null);
    start(async () => {
      const res = await action();
      if (res.ok && res.url) window.location.href = res.url;
      else setError(res.error ?? "Something went wrong.");
    });
  }

  const pct =
    limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor =
    pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-[var(--accent)]";
  const remaining = limit != null ? Math.max(0, limit - used) : null;
  const renews = periodEnd ? formatShortDate(periodEnd) : null;
  const footer =
    plan === "pro" && renews
      ? `Renews ${renews}`
      : remaining != null
        ? `${formatInt(remaining)} requests left this month`
        : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2">
        <CardTitle>Plan</CardTitle>
        <span className="text-sm font-medium text-[var(--text)]">
          {planLabel(plan)}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-[var(--text-faint)]">
          <span>Requests this month</span>
          <span className="tabular-nums">
            {formatInt(used)}
            {limit != null ? ` / ${formatInt(limit)}` : ""}
          </span>
        </div>
        {limit != null && (
          <div className="neu-inset-sm mt-2 h-2 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {footer && (
          <p className="mt-2.5 text-xs text-[var(--text-faint)]">{footer}</p>
        )}
        {plan === "free" && used >= FREE_MONTHLY_REQUESTS && (
          <p className="mt-2 text-xs text-red-400">
            Free limit reached. Calls return 402 until you upgrade.
          </p>
        )}
      </div>

      <div className="mt-auto pt-6">
        {plan === "free" ? (
          <Button
            onClick={() => go(startProCheckout)}
            disabled={pending}
            className="w-full"
          >
            {pending ? "Starting…" : `Upgrade to Pro ($${PRO_PRICE_USD}/mo)`}
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => go(openBillingPortal)}
            disabled={pending}
            className="w-full"
          >
            {pending ? "Opening…" : "Manage billing"}
          </Button>
        )}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
