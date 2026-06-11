"use client";

import { useState, useTransition } from "react";
import { deleteProxyKey, revokeProxyKey } from "@/app/dashboard/actions";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/format";

export interface KeyItem {
  id: string;
  keyPrefix: string;
  isActive: boolean;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
  name?: string | null;
  createdAt?: string | null;
  lastUsedAt?: string | null;
}

const shortDate = formatShortDate;

export function KeyList({ keys }: { keys: KeyItem[] }) {
  const [pending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState<string | null>(null);

  if (keys.length === 0) {
    return <p className="text-xs text-[var(--text-faint)]">No keys yet.</p>;
  }

  function revoke(id: string) {
    setRevoking(id);
    startTransition(async () => {
      const res = await revokeProxyKey(id);
      if (!res.ok) toast(res.error ?? "Failed to revoke the key.", "error");
      else toast("Key revoked. It stops working within seconds.");
      setRevoking(null);
    });
  }

  function remove(id: string) {
    setRevoking(id);
    startTransition(async () => {
      const res = await deleteProxyKey(id);
      if (!res.ok) toast(res.error ?? "Failed to remove the key.", "error");
      else toast("Key removed.");
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
              {k.lastUsedAt ? (
                <> · Last used {shortDate(k.lastUsedAt)}</>
              ) : (
                <> · Never used</>
              )}
              {k.dailyLimit != null && <> · ${k.dailyLimit}/day cap</>}
              {k.monthlyLimit != null && <> · ${k.monthlyLimit}/mo cap</>}
            </div>
          </div>
          {k.isActive ? (
            <Button
              variant="danger"
              className="shrink-0 px-2.5 py-1.5 text-xs"
              disabled={pending && revoking === k.id}
              onClick={() => revoke(k.id)}
            >
              {pending && revoking === k.id ? "Revoking…" : "Revoke"}
            </Button>
          ) : (
            <button
              type="button"
              className="shrink-0 text-xs text-[var(--text-faint)] underline-offset-2 hover:text-[var(--text-muted)] hover:underline disabled:opacity-50"
              disabled={pending && revoking === k.id}
              onClick={() => remove(k.id)}
            >
              {pending && revoking === k.id ? "Removing…" : "Remove"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
