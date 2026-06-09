"use client";

import { useState, useTransition } from "react";
import { createConnection } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { findPreset, PROVIDER_PRESETS } from "@/lib/providers";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-[var(--text-faint)]">
          {hint}
        </span>
      )}
    </label>
  );
}

export function AddConnectionForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const preset = presetId ? findPreset(presetId) : undefined;
  const perToken = preset?.metering === "per_token";

  function applyPreset(id: string) {
    setPresetId(id);
    const p = findPreset(id);
    if (!p) return;
    setName(p.label);
    setUrl(p.baseUrl);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    if (!formData.get("costPerRequest")) formData.set("costPerRequest", "0");
    startTransition(async () => {
      const res = await createConnection(formData);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
      } else {
        setPresetId("");
        setName("");
        setUrl("");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <input type="hidden" name="meteringMode" value={preset?.metering ?? "flat"} />
      <input type="hidden" name="inputTokenCost" value={preset?.inputTokenCost ?? 0} />
      <input type="hidden" name="outputTokenCost" value={preset?.outputTokenCost ?? 0} />

      <Field label="Provider" hint="Pick one to auto-fill the URL and pricing, or choose Custom.">
        <select
          value={presetId}
          onChange={(e) => applyPreset(e.target.value)}
          className="w-full neu-inset bg-[var(--bg-deep)] px-3.5 py-2.5 text-sm text-[var(--text)] focus:outline-none"
        >
          <option value="">Custom</option>
          {PROVIDER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Connection name">
        <Input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="OpenAI"
          required
        />
      </Field>

      <Field label="Base URL">
        <Input
          name="targetUrl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          required
        />
      </Field>

      <Field
        label="Auth header"
        hint="Your real API key. Encrypted in a vault, never logged."
      >
        <Textarea
          name="headers"
          rows={2}
          placeholder="Authorization: Bearer sk-..."
          required
        />
      </Field>

      {perToken ? (
        <p className="neu-inset-sm px-3 py-2 text-xs text-[var(--text-muted)]">
          Billed per token at list price. We read usage from each response.
        </p>
      ) : (
        <Field label="Cost per call (USD)" hint="Deducted per request. Blank = free.">
          <Input
            name="costPerRequest"
            type="number"
            step="0.000001"
            min="0"
            placeholder="0.01"
            className="max-w-[200px]"
          />
        </Field>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Adding…" : "Add connection"}
      </Button>
    </form>
  );
}
