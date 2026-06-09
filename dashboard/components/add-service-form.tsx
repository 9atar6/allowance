"use client";

import { useState, useTransition } from "react";
import { createProjectEndpoint } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

export function AddServiceForm({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    if (!formData.get("costPerRequest")) formData.set("costPerRequest", "0");
    startTransition(async () => {
      const res = await createProjectEndpoint(formData);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
      } else {
        setName("");
        setSlug("");
        setSlugEdited(false);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />

      <Field label="Service name">
        <Input
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          placeholder="OpenAI"
          required
        />
      </Field>

      <Field label="Base URL">
        <Input name="targetUrl" placeholder="https://api.openai.com/v1" required />
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

      <details className="group">
        <summary className="cursor-pointer text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
          Advanced
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Path slug" hint="Calls route to /v1/proxy/{slug}">
            <Input
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
              }}
              placeholder="openai"
              required
            />
          </Field>
          <Field label="Cost per call (USD)" hint="Deducted per request. Blank = free.">
            <Input
              name="costPerRequest"
              type="number"
              step="0.000001"
              min="0"
              placeholder="0.01"
            />
          </Field>
        </div>
      </details>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Adding…" : "Add service"}
      </Button>
    </form>
  );
}
