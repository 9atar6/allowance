"use client";

import { useState, useTransition } from "react";
import { revokeProxyKey } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export interface KeyItem {
  id: string;
  keyPrefix: string;
  isActive: boolean;
}

export function KeyList({ keys }: { keys: KeyItem[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  if (keys.length === 0) {
    return <p className="text-xs text-neutral-600">No keys yet.</p>;
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
        <li key={k.id} className="flex items-center justify-between text-xs">
          <code className="text-neutral-400">
            {k.keyPrefix}…{" "}
            {!k.isActive && <span className="text-neutral-600">(revoked)</span>}
          </code>
          {k.isActive && (
            <Button
              variant="danger"
              className="px-2 py-1 text-xs"
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
