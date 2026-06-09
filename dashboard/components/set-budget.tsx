"use client";

import { useState, useTransition } from "react";
import { setBudget } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Set the spend budget. Free — it's a cap, not a payment. Your providers still
 * bill you directly; this just decides when Allowance cuts your agents off.
 */
export function SetBudget({ current }: { current: number }) {
  const [pending, start] = useTransition();
  const [val, setVal] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    const n = Number(formData.get("amount"));
    if (!(Number.isFinite(n) && n >= 0)) {
      setError("Enter a budget amount.");
      return;
    }
    start(async () => {
      const res = await setBudget(n);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else setVal("");
    });
  }

  return (
    <form action={onSubmit}>
      <div className="flex gap-2">
        <Input
          name="amount"
          type="number"
          min="0"
          step="1"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={`Set budget (now $${current.toFixed(2)})`}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "…" : "Set"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </form>
  );
}
