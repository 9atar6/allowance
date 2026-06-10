"use client";

import { useEffect, useState } from "react";

export interface Toast {
  id: number;
  message: string;
  kind: "success" | "error";
}

// Module-level pub/sub so any client component can fire a toast without context.
type Listener = (t: Toast) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function toast(message: string, kind: Toast["kind"] = "success"): void {
  const t: Toast = { id: nextId++, message, kind };
  for (const l of listeners) l(t);
}

const TOAST_MS = 3500;

/** Mount once (dashboard layout). Renders the stacked notifications. */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast: Listener = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(
        () => setToasts((prev) => prev.filter((x) => x.id !== t.id)),
        TOAST_MS,
      );
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex w-72 flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="neu animate-in flex items-start gap-2.5 p-3.5 text-sm"
        >
          <span
            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
              t.kind === "success" ? "bg-[var(--accent)]" : "bg-red-400"
            }`}
            aria-hidden
          />
          <span className="text-[var(--text)]">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
