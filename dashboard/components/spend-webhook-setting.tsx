"use client";

import { useState, useTransition } from "react";
import { setSpendWebhook } from "@/app/dashboard/actions";
import { toast } from "@/components/toaster";

/**
 * Spend webhook: we POST to this URL when budget consumption crosses
 * 50% / 80% / 100% of the last-set budget. Blank = off.
 */
export function SpendWebhookSetting({ current }: { current: string | null }) {
  const [val, setVal] = useState(current ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    start(async () => {
      const res = await setSpendWebhook(val.trim() || null);
      if (!res.ok) toast(res.error ?? "Could not save the webhook.", "error");
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        toast(
          val.trim()
            ? "Webhook on: we POST at 50%, 80%, and 100% of your budget."
            : "Spend webhook turned off.",
        );
      }
    });
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[var(--text-faint)]">Webhook at 50/80/100%</span>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        type="url"
        placeholder="https:// (off)"
        className="neu-inset w-52 px-2.5 py-1.5 text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="neu-sm pressable px-2.5 py-1.5 font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {pending ? "…" : saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
