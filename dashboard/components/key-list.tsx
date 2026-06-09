"use client";

import { useState, useTransition } from "react";
import { revokeProxyKey } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export interface KeyItem {
  id: string;
  keyPrefix: string;
  isActive: boolean;
  dailyLimit?: number | null;
  name?: string | null;
  createdAt?: string | null;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function KeyList({ keys }: { keys: KeyItem[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  if (keys.length === 0) {
    return <p className="text-xs text-[var(--text-faint)]">No keys yet.</p>;
  }

  function revoke(id: string) {
    setError(null);
    setRevoking(id);
    startTransition(async () => {
      const res = await revokeProxyKey(id);
      if (!res.ok) setError(res.error ?? "Failed to revoke.");
      setRevoking(null);
    });
  }

  return (
    <ul className="space-y-1">
      {keys.map((k) => (
        <li key={k.id} className="flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {k.name && (
                <span className="font-medium text-[var(--text)]">{k.name}</span>
              )}
              <code className="font-mono text-[var(--text-muted)]">
                {k.keyPrefix}…
              </code>
              {!k.isActive && (
                <span className="text-[var(--text-faint)]">(revoked)</span>
              )}
            </div>
            <div className="mt-0.5 text-[var(--text-faint)]">
              {k.createdAt && <>Created {shortDate(k.createdAt)}</>}
              {k.dailyLimit != null && <> · ${k.dailyLimit}/day cap</>}
            </div>
          </div>
          {k.isActive && (
            <Button
              variant="danger"
              className="shrink-0 px-2.5 py-1.5 text-xs"
              disabled={pending && revoking === k.id}
              onClick={() => revoke(k.id)}
            >
              {pending && revoking === k.id ? "Revoking…" : "Revoke"}
            </Button>
          )}
        </li>
      ))}
      {error && <li className="text-xs text-red-400">{error}</li>}
    </ul>
  );
}
