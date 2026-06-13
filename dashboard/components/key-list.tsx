"use client";

import { useState, useTransition } from "react";
import {
  deleteProxyKey,
  revokeProxyKey,
  rotateProxyKey,
} from "@/app/dashboard/actions";
import { CopyButton } from "@/components/copy-button";
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
  expiresAt?: string | null;
  parentKeyId?: string | null;
  budgetLimit?: number | null;
}

const shortDate = formatShortDate;

function isExpiring(k: KeyItem): boolean {
  return Boolean(
    k.isActive && k.expiresAt && new Date(k.expiresAt).getTime() > Date.now(),
  );
}

/** Death is near: within 48h. Drives the amber warning, not the meta line. */
function isExpiringSoon(k: KeyItem): boolean {
  if (!isExpiring(k) || !k.expiresAt) return false;
  return new Date(k.expiresAt).getTime() - Date.now() < 48 * 60 * 60 * 1000;
}

/** Past its grace window: dead at the proxy even though is_active is true. */
function isExpired(k: KeyItem): boolean {
  return Boolean(
    k.isActive && k.expiresAt && new Date(k.expiresAt).getTime() <= Date.now(),
  );
}

export function KeyList({ keys }: { keys: KeyItem[] }) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);

  if (keys.length === 0) {
    return <p className="text-xs text-[var(--text-faint)]">No keys yet.</p>;
  }

  function revoke(id: string) {
    setBusy(id);
    startTransition(async () => {
      const res = await revokeProxyKey(id);
      if (!res.ok) toast(res.error ?? "Failed to revoke the key.", "error");
      else toast("Key revoked. It stops working within seconds.");
      setBusy(null);
    });
  }

  function remove(id: string) {
    setBusy(id);
    startTransition(async () => {
      const res = await deleteProxyKey(id);
      if (!res.ok) toast(res.error ?? "Failed to remove the key.", "error");
      else toast("Key removed.");
      setBusy(null);
    });
  }

  function rotate(id: string) {
    setBusy(id);
    startTransition(async () => {
      const res = await rotateProxyKey(id);
      if (!res.ok || !res.generatedKey) {
        toast(res.error ?? "Failed to rotate the key.", "error");
      } else {
        setRotatedKey(res.generatedKey);
        toast("Key rotated. The old key keeps working for 24 hours.");
      }
      setBusy(null);
    });
  }

  return (
    <div>
      {rotatedKey && (
        <div className="neu-inset mb-3 p-3">
          <p className="text-xs text-[var(--text-muted)]">
            New key. Copy it now, it is shown only once. The old key keeps
            working for 24 hours so nothing breaks while you swap it.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 break-all font-mono text-xs text-[var(--accent-strong,var(--accent))]">
              {rotatedKey}
            </code>
            <CopyButton text={rotatedKey} />
          </div>
        </div>
      )}

      <ul className="space-y-1">
        {keys.map((k) => (
          <li
            key={k.id}
            className={`flex items-center justify-between gap-2 text-xs ${
              k.parentKeyId ? "ml-4 border-l border-[var(--line)] pl-3" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {k.name && (
                  <span className="font-medium text-[var(--text)]">{k.name}</span>
                )}
                {k.parentKeyId && (
                  <span className="text-[var(--accent)]">
                    pocket money
                    {k.budgetLimit != null && ` · $${k.budgetLimit}`}
                  </span>
                )}
                <code className="font-mono text-[var(--text-muted)]">
                  {k.keyPrefix}…
                </code>
                {!k.isActive && (
                  <span className="text-[var(--text-faint)]">(revoked)</span>
                )}
                {isExpiringSoon(k) && (
                  <span className="text-amber-500">(expiring)</span>
                )}
                {isExpired(k) && (
                  <span className="text-[var(--text-faint)]">
                    (expired · revoke to remove)
                  </span>
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
                {isExpiring(k) && k.expiresAt && (
                  <> · dies {shortDate(k.expiresAt)}</>
                )}
              </div>
            </div>
            {k.isActive ? (
              <div className="flex shrink-0 items-center gap-2">
                {!isExpiring(k) && !isExpired(k) && !k.parentKeyId && (
                  <button
                    type="button"
                    className="text-xs text-[var(--text-faint)] underline-offset-2 hover:text-[var(--text-muted)] hover:underline disabled:opacity-50"
                    disabled={pending && busy === k.id}
                    onClick={() => rotate(k.id)}
                    title="Mint a fresh key; the old one keeps working for 24 hours."
                  >
                    {pending && busy === k.id ? "Rotating…" : "Rotate"}
                  </button>
                )}
                <Button
                  variant="danger"
                  className="px-2.5 py-1.5 text-xs"
                  disabled={pending && busy === k.id}
                  onClick={() => revoke(k.id)}
                >
                  {pending && busy === k.id ? "Working…" : "Revoke"}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="shrink-0 text-xs text-[var(--text-faint)] underline-offset-2 hover:text-[var(--text-muted)] hover:underline disabled:opacity-50"
                disabled={pending && busy === k.id}
                onClick={() => remove(k.id)}
              >
                {pending && busy === k.id ? "Removing…" : "Remove"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
