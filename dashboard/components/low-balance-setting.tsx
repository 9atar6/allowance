"use client";

import { useState, useTransition } from "react";
import { setLowBalanceThreshold } from "@/app/dashboard/actions";

export function LowBalanceSetting({ current }: { current: number | null }) {
  const [val, setVal] = useState(current != null ? String(current) : "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    const n = Number(val);
    const threshold =
      val.trim() === "" ? null : Number.isFinite(n) && n > 0 ? n : null;
    start(async () => {
      const res = await setLowBalanceThreshold(threshold);
      if (!res.ok) setError(res.error ?? "Failed.");
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[var(--text-faint)]">Email me below</span>
      <div className="relative">
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
          className="neu-inset w-24 py-1.5 pl-5 pr-2 text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="neu-sm pressable px-2.5 py-1.5 font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {pending ? "…" : saved ? "Saved" : "Save"}
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
