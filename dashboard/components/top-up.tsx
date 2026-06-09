"use client";

import { useState, useTransition } from "react";
import { createTopUp } from "@/app/dashboard/billing-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TopUp() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createTopUp(formData);
      if (!res.ok || !res.url) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      // Redirect to Stripe-hosted Checkout.
      window.location.href = res.url;
    });
  }

  return (
    <form action={onSubmit}>
      <div className="flex gap-2">
        <Input
          name="amount"
          type="number"
          min="5"
          step="1"
          placeholder="Amount USD (min $5)"
          required
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "…" : "Top up"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </form>
  );
}
