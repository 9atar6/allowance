"use client";

import { useState, useTransition } from "react";
import {
  disableAutoReload,
  startAutoReloadSetup,
} from "@/app/dashboard/billing-actions";

interface Props {
  enabled: boolean;
  amount: number | null;
}

export function AutoReloadSetting({ enabled, amount }: Props) {
  const [val, setVal] = useState(amount != null ? String(amount) : "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function enable() {
    setError(null);
    const n = Number(val);
    if (!(Number.isFinite(n) && n > 0)) {
      setError("Enter an amount.");
      return;
    }
    start(async () => {
      const res = await startAutoReloadSetup(n);
      if (res.ok && res.url) window.location.href = res.url;
      else setError(res.error ?? "Could not start.");
    });
  }

  function disable() {
    setError(null);
    start(async () => {
      const res = await disableAutoReload();
      if (res.ok) window.location.reload();
      else setError(res.error ?? "Could not disable.");
    });
  }

  if (enabled) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[var(--text-faint)]">
          Auto-reload{" "}
          <span className="text-[var(--text)]">
            ${amount?.toFixed(2)}
          </span>{" "}
          when low
        </span>
        <button
          type="button"
          onClick={disable}
          disabled={pending}
          className="neu-sm pressable px-2.5 py-1.5 font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          {pending ? "…" : "Disable"}
        </button>
        {error && <span className="text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[var(--text-faint)]">Auto-reload</span>
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
          placeholder="20"
          className="neu-inset w-24 py-1.5 pl-5 pr-2 text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={enable}
        disabled={pending}
        className="neu-sm pressable px-2.5 py-1.5 font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {pending ? "…" : "Enable"}
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
