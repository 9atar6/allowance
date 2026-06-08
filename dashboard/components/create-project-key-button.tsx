"use client";

import { useState, useTransition } from "react";
import { createProjectKey } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateProjectKeyButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState("");

  function mint() {
    setError(null);
    startTransition(async () => {
      const n = Number(limit);
      const dailyLimit = limit.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
      const res = await createProjectKey(projectId, dailyLimit);
      if (!res.ok) setError(res.error ?? "Failed.");
      else setGenerated(res.generatedKey ?? null);
    });
  }

  if (generated) {
    return (
      <div className="rounded-md border border-amber-700/50 bg-amber-950/30 p-3">
        <p className="mb-1 text-xs font-medium text-amber-400">
          Copy this key now. It is shown only once.
        </p>
        <code className="block break-all text-xs text-amber-200">{generated}</code>
        <Button
          variant="ghost"
          className="mt-2 text-xs"
          onClick={() => navigator.clipboard.writeText(generated)}
        >
          Copy
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Input
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          placeholder="Daily limit USD (optional)"
          className="max-w-[200px]"
        />
        <Button
          variant="ghost"
          onClick={mint}
          disabled={pending}
          className="shrink-0 text-xs"
        >
          {pending ? "Minting…" : "Create project key"}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
