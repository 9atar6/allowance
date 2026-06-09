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
      <div className="neu-inset p-4">
        <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
          Copy this key now — it is shown only once.
        </p>
        <code className="block break-all font-mono text-xs text-[var(--accent)]">
          {key}
        </code>
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
