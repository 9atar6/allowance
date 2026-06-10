"use client";

import { useState, useTransition } from "react";
import {
  createProjectKey,
  testProxyCall,
  type TestCallResult,
} from "@/app/dashboard/actions";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Fires one real proxied call with the just-minted key and shows the verdict. */
function TestCallButton({
  plainKey,
  slug,
}: {
  plainKey: string;
  slug: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TestCallResult | null>(null);

  function run() {
    setResult(null);
    start(async () => {
      setResult(await testProxyCall(plainKey, slug));
    });
  }

  return (
    <div className="mt-3 border-t border-[var(--line)] pt-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button onClick={run} disabled={pending} className="px-3 py-2 text-xs">
          {pending ? "Calling…" : "Test it"}
        </Button>
        <span className="text-xs text-[var(--text-faint)]">
          Sends one real call through /{slug} to prove everything works.
        </span>
      </div>
      {result && (
        <p
          className={`mt-2 text-xs ${
            result.ok ? "text-[var(--accent)]" : "text-red-400"
          }`}
          role="status"
        >
          {result.ok ? "✓" : "✗"}
          {result.status != null ? ` ${result.status} ` : " "}
          {result.message}
        </p>
      )}
    </div>
  );
}

export function CreateProjectKeyButton({
  projectId,
  testSlug,
}: {
  projectId: string;
  testSlug?: string | null;
}) {
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
          Copy this key now, it is shown only once.
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--accent)]">
            {generated}
          </code>
          <CopyButton text={generated} className="neu-sm pressable" />
        </div>
        {testSlug && <TestCallButton plainKey={generated} slug={testSlug} />}
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
