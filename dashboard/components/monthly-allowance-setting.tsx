"use client";

import { useState, useTransition } from "react";
import { setMonthlyAllowance } from "@/app/dashboard/actions";
import { toast } from "@/components/toaster";

/**
 * Monthly auto-refill: the budget resets itself to this amount on the 1st
 * (UTC). The product's namesake. Blank = off (manual budget only).
 */
export function MonthlyAllowanceSetting({ current }: { current: number | null }) {
  const [val, setVal] = useState(current != null ? String(current) : "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    const n = Number(val);
    const amount = val.trim() === "" ? null : Number.isFinite(n) && n > 0 ? n : null;
    start(async () => {
      const res = await setMonthlyAllowance(amount);
      if (!res.ok) toast(res.error ?? "Could not save the allowance.", "error");
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        toast(
          amount != null
            ? `Allowance on: budget refills to $${amount.toFixed(2)} monthly.`
            : "Monthly allowance turned off.",
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 text-[var(--text-faint)]">Auto-refill monthly</span>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]">
          $
        </span>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          type="number"
          min="0"
          step="1"
          placeholder="off"
          className="neu-inset w-full py-1.5 pl-5 pr-2 text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="neu-sm pressable w-16 shrink-0 py-1.5 text-center font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {pending ? "…" : saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
