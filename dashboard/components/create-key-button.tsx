"use client";

import { useState, useTransition } from "react";
import { createProxyKey } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export function CreateKeyButton({ endpointId }: { endpointId: string }) {
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function mint() {
    setError(null);
    startTransition(async () => {
      const res = await createProxyKey(endpointId);
      if (!res.ok) setError(res.error ?? "Failed.");
      else setKey(res.generatedKey ?? null);
    });
  }

  if (key) {
    return (
      <div className="rounded-md border border-amber-700/50 bg-amber-950/30 p-3">
        <p className="mb-1 text-xs font-medium text-amber-400">
          Copy this key now. It is shown only once.
        </p>
        <code className="block break-all text-xs text-amber-200">{key}</code>
        <Button
          variant="ghost"
          className="mt-2 text-xs"
          onClick={() => navigator.clipboard.writeText(key)}
        >
          Copy
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" onClick={mint} disabled={pending} className="text-xs">
        {pending ? "Minting…" : "Create proxy key"}
      </Button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
