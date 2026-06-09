"use client";

import { useState, useTransition } from "react";
import { createEndpoint } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function AddEndpointForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"flat" | "per_token">("flat");

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createEndpoint(formData);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        (document.getElementById("add-endpoint") as HTMLFormElement)?.reset();
        setMode("flat");
      }
    });
  }

  return (
    <form id="add-endpoint" action={onSubmit} className="space-y-3">
      <Input name="name" placeholder="Endpoint name (e.g. OpenAI)" required />
      <Input name="targetUrl" placeholder="https://api.openai.com/v1" required />

      <label className="block text-xs text-[var(--text-faint)]">Metering</label>
      <select
        name="meteringMode"
        value={mode}
        onChange={(e) => setMode(e.target.value as "flat" | "per_token")}
        className="w-full neu-inset bg-[var(--bg-deep)] px-3.5 py-2.5 text-sm text-[var(--text)] focus:outline-none"
      >
        <option value="flat">Flat (per request)</option>
        <option value="per_token">Per token (OpenAI-style usage)</option>
      </select>

      <Input
        name="costPerRequest"
        type="number"
        step="0.000001"
        min="0"
        placeholder={
          mode === "flat"
            ? "Cost per request (USD), e.g. 0.01"
            : "Fallback flat fee when usage is absent (USD)"
        }
        required
      />

      {mode === "per_token" && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            name="inputTokenCost"
            type="number"
            step="0.0000001"
            min="0"
            placeholder="Input $/token"
          />
          <Input
            name="outputTokenCost"
            type="number"
            step="0.0000001"
            min="0"
            placeholder="Output $/token"
          />
        </div>
      )}

      <Textarea
        name="headers"
        rows={3}
        placeholder={"Authorization: Bearer sk-...\nOpenAI-Organization: org-..."}
        required
      />
      <p className="text-xs text-[var(--text-faint)]">
        Credentials are encrypted in Supabase Vault. They are never stored or
        logged in plaintext.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add endpoint"}
      </Button>
    </form>
  );
}
