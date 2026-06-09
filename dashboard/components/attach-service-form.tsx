"use client";

import { useState, useTransition } from "react";
import { attachService } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface ConnOpt {
  id: string;
  name: string;
}

export function AttachServiceForm({
  projectId,
  connections,
}: {
  projectId: string;
  connections: ConnOpt[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [endpointId, setEndpointId] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await attachService(formData);
      if (!res.ok) {
        setError(res.error ?? "Failed.");
      } else {
        setEndpointId("");
        setSlug("");
        setSlugEdited(false);
      }
    });
  }

  if (connections.length === 0) {
    return (
      <p className="text-xs text-[var(--text-faint)]">
        Add a connection above first, then attach it here.
      </p>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <select
        name="endpointId"
        value={endpointId}
        onChange={(e) => {
          setEndpointId(e.target.value);
          if (!slugEdited) {
            const c = connections.find((x) => x.id === e.target.value);
            if (c) setSlug(slugify(c.name));
          }
        }}
        required
        className="select-neu neu-inset bg-[var(--bg-deep)] px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
      >
        <option value="">Choose a connection</option>
        {connections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Input
        name="slug"
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          setSlugEdited(true);
        }}
        placeholder="slug"
        required
        className="max-w-[140px] text-xs"
      />
      <Button type="submit" variant="ghost" disabled={pending} className="text-xs">
        {pending ? "…" : "Attach"}
      </Button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </form>
  );
}
