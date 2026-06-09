"use client";

import { useState, useTransition } from "react";
import {
  openBillingPortal,
  startProCheckout,
  type SubResult,
} from "@/app/dashboard/billing-actions";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
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
}

export function PlanCard({ plan, used, limit }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go(action: () => Promise<SubResult>) {
    setError(null);
    start(async () => {
      const res = await action();
      if (res.ok && res.url) {
        window.location.href = res.url;
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  const pct =
    limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor =
    pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Plan</CardTitle>
          <p className="mt-1 text-sm">
            <span className="font-medium text-white">{planLabel(plan)}</span>
            {plan === "free" && (
              <span className="text-neutral-500">
                {" "}
                · {FREE_MONTHLY_REQUESTS.toLocaleString()} requests/mo
              </span>
            )}
          </p>
        </div>
        {plan === "free" ? (
          <Button onClick={() => go(startProCheckout)} disabled={pending}>
            {pending ? "Starting…" : `Upgrade to Pro — $${PRO_PRICE_USD}/mo`}
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => go(openBillingPortal)}
            disabled={pending}
          >
            {pending ? "Opening…" : "Manage billing"}
          </Button>
        )}
      </div>

      {/* Monthly usage meter */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-neutral-500">
          <span>Requests this month</span>
          <span className="tabular-nums">
            {used.toLocaleString()}
            {limit != null ? ` / ${limit.toLocaleString()}` : ""}
          </span>
        </div>
        {limit != null && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        )}
        {plan === "free" && used >= FREE_MONTHLY_REQUESTS && (
          <p className="mt-2 text-xs text-red-400">
            Free limit reached. Calls return HTTP 402 until you upgrade or the
            month resets.
          </p>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </Card>
  );
}
