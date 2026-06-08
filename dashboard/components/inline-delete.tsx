"use client";

import { useState, useTransition } from "react";

interface Props {
  action: () => Promise<{ ok: boolean; error?: string }>;
  label?: string;
  className?: string;
}

/** Two-step (arm -> confirm) delete button backed by a bound server action. */
export function InlineDelete({ action, label = "Remove", className }: Props) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Failed.");
        setArmed(false);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={className ?? "text-xs text-neutral-500 hover:text-red-400"}
      >
        {pending ? "…" : armed ? "Confirm?" : label}
      </button>
      {armed && !pending && (
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-xs text-neutral-600 hover:text-neutral-400"
        >
          cancel
        </button>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
