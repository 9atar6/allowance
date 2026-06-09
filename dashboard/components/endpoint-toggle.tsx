"use client";

import { useState, useTransition } from "react";
import { setEndpointActive } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

interface Props {
  endpointId: string;
  isActive: boolean;
}

export function EndpointToggle({ endpointId, isActive }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setEndpointActive(endpointId, !isActive);
      if (!res.ok) setError(res.error ?? "Failed.");
    });
  }

  return (
    <span className="flex items-center gap-2">
      <span
        className={`text-xs ${isActive ? "text-[var(--indigo-bright)]" : "text-[var(--text-faint)]"}`}
      >
        {isActive ? "Active" : "Disabled"}
      </span>
      <Button
        variant="ghost"
        className="px-2 py-1 text-xs"
        disabled={pending}
        onClick={toggle}
      >
        {pending ? "…" : isActive ? "Disable" : "Enable"}
      </Button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
