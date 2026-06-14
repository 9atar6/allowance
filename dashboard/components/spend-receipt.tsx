"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { formatUsd as usd, formatInt } from "@/lib/format";

interface ReceiptService {
  name: string;
  requests: number;
  cost: number;
}

interface SpendReceiptProps {
  services: ReceiptService[];
  totalSpent: number;
  budgetLeft: number;
  /** Period the figures cover, in days (matches the server query). */
  periodDays: number;
}

const REFRESH_MS = 30_000; // "almost real time" without sockets
const MAX_LINES = 9; // keep the slip a believable length; rest folds into "other"

/**
 * The spend slip — the homepage receipt, but real. Same analog-ledger styling,
 * fed by the account's own numbers, and exportable as a PNG to share. The image
 * is rendered in the browser (html-to-image), so the figures never travel
 * through a share URL or our servers.
 */
export function SpendReceipt({
  services,
  totalSpent,
  budgetLeft,
  periodDays,
}: SpendReceiptProps) {
  const router = useRouter();
  const slipRef = useRef<HTMLDivElement | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Live-ish: re-pull the dashboard every 30s while the tab is visible. Paused
  // when hidden so a backgrounded tab costs nothing.
  useEffect(() => {
    setUpdatedAt(new Date().toISOString().slice(11, 19) + " UTC");
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [router]);

  const save = useCallback(async () => {
    const node = slipRef.current;
    if (!node) return;
    setSaving(true);
    try {
      const bg = getComputedStyle(document.documentElement)
        .getPropertyValue("--bg")
        .trim();
      const url = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: bg || "#F5F4EE",
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = "allowance-receipt.png";
      a.click();
    } finally {
      setSaving(false);
    }
  }, []);

  // Fold the long tail into a single "other services" line so the slip stays
  // readable no matter how many endpoints are in play.
  const sorted = [...services].sort((a, b) => b.cost - a.cost);
  const shown = sorted.slice(0, MAX_LINES);
  const rest = sorted.slice(MAX_LINES);
  const restCost = rest.reduce((s, r) => s + r.cost, 0);
  const restReq = rest.reduce((s, r) => s + r.requests, 0);
  const totalReq = sorted.reduce((s, r) => s + r.requests, 0);
  const serial = String(totalReq % 100000).padStart(5, "0");
  const cap = budgetLeft + totalSpent;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-faint)]">
          {updatedAt ? (
            <>
              <span className="text-[var(--vault)]">●</span> Live · last{" "}
              {periodDays} days · updated {updatedAt}
            </>
          ) : (
            <>Last {periodDays} days</>
          )}
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="neu-sm pressable px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save image"}
        </button>
      </div>

      {/* The slip itself — this exact node is what gets exported. */}
      <div
        ref={slipRef}
        className="receipt mx-auto mt-4 max-w-md p-7 text-left text-[13px]"
      >
        <div className="text-center">
          <p className="font-display text-lg lowercase tracking-tight">allowance</p>
          <p className="mt-1 label-caps">spend receipt</p>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--text-faint)]">
          <span>last {periodDays} days</span>
          <span>no. {serial} · utc</span>
        </div>
        <div className="my-3 border-t border-dashed border-[var(--line-strong)]" />

        {shown.length === 0 ? (
          <p className="py-4 text-center text-[var(--text-faint)]">
            Nothing spent yet. Suspicious, but fine.
          </p>
        ) : (
          <>
            {shown.map((s) => (
              <div key={s.name} className="mt-2 receipt-line">
                <span className="text-[var(--text-muted)]">
                  {s.name}
                  <span className="ml-2 text-[11px] text-[var(--text-faint)]">
                    {formatInt(s.requests)} calls
                  </span>
                </span>
                <span className="leader" />
                <span className="tabular-nums text-[var(--text-muted)]">
                  -{usd(s.cost)}
                </span>
              </div>
            ))}
            {rest.length > 0 && (
              <div className="mt-2 receipt-line">
                <span className="text-[var(--text-muted)]">
                  other services
                  <span className="ml-2 text-[11px] text-[var(--text-faint)]">
                    {formatInt(restReq)} calls
                  </span>
                </span>
                <span className="leader" />
                <span className="tabular-nums text-[var(--text-muted)]">
                  -{usd(restCost)}
                </span>
              </div>
            )}
          </>
        )}

        <div className="my-3 border-t border-dashed border-[var(--line-strong)]" />
        <div className="receipt-line">
          <span className="text-[var(--text-faint)]">spent · last {periodDays} days</span>
          <span className="leader" />
          <span className="tabular-nums text-[var(--text-faint)]">
            -{usd(totalSpent)}
          </span>
        </div>
        <div className="mt-2 receipt-line text-base">
          <span className="text-[var(--text)]">left of {usd(cap)} cap</span>
          <span className="leader" />
          <span className="tabular-nums font-medium text-[var(--vault)]">
            {usd(budgetLeft)}
          </span>
        </div>
        <div className="mt-5 text-center text-[11px] tracking-[0.16em] text-[var(--text-faint)]">
          ALLOW ONCE · NO OVERDRAFTS
        </div>
      </div>
    </div>
  );
}
