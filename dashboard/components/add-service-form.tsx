"use client";

import { useState, useTransition } from "react";
import { createProjectEndpoint } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function AddServiceForm({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formId = `add-service-${projectId}`;

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createProjectEndpoint(formData);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else (document.getElementById(formId) as HTMLFormElement)?.reset();
    });
  }

  return (
    <form id={formId} action={onSubmit} className="space-y-2">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="name" placeholder="Service name (e.g. OpenAI)" required />
        <Input name="slug" placeholder="slug (e.g. openai)" required />
      </div>
      <Input name="targetUrl" placeholder="https://api.openai.com/v1" required />
      <Input
        name="costPerRequest"
        type="number"
        step="0.000001"
        min="0"
        placeholder="Cost per request USD, e.g. 0.01"
        required
      />
      <Textarea name="headers" rows={2} placeholder={"Authorization: Bearer sk-..."} required />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" variant="ghost" disabled={pending} className="text-xs">
        {pending ? "Adding…" : "Add service"}
      </Button>
    </form>
  );
}
