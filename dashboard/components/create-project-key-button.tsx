"use client";

import { useState, useTransition } from "react";
import { createProjectKey } from "@/app/dashboard/actions";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateProjectKeyButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [monthly, setMonthly] = useState("");

  function parseLimit(raw: string): number | null {
    const n = Number(raw);
    return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
  }

  function mint() {
    setError(null);
    startTransition(async () => {
      const res = await createProjectKey(
        projectId,
        parseLimit(limit),
        name || null,
        parseLimit(monthly),
      );
      if (!res.ok) setError(res.error ?? "Failed.");
      else setGenerated(res.generatedKey ?? null);
    });
  }

  if (generated) {
    return (
      <div className="neu-inset p-4">
        <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
          Copy this key now — it is shown only once.
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--accent)]">
            {generated}
          </code>
          <CopyButton text={generated} className="neu-sm pressable" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. prod)"
          className="max-w-[180px]"
        />
        <Input
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          placeholder="$/day cap (optional)"
          className="max-w-[160px]"
        />
        <Input
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          placeholder="$/month cap (optional)"
          className="max-w-[170px]"
        />
        <Button
          variant="ghost"
          onClick={mint}
          disabled={pending}
          className="shrink-0 text-xs"
        >
          {pending ? "Minting…" : "New key"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
