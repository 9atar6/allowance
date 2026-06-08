"use client";

import { useState, useTransition } from "react";
import { createProject } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateProjectForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createProject(formData);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else (document.getElementById("create-project") as HTMLFormElement)?.reset();
    });
  }

  return (
    <form id="create-project" action={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <Input name="name" placeholder="Project name (e.g. My SaaS)" required />
      <Input
        name="monthlyBudget"
        type="number"
        step="0.01"
        min="0"
        placeholder="Monthly budget USD (optional)"
      />
      <Button type="submit" disabled={pending} className="shrink-0">
        {pending ? "…" : "Create project"}
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
