import { AddServiceForm } from "@/components/add-service-form";
import { CreateProjectForm } from "@/components/create-project-form";
import { CreateProjectKeyButton } from "@/components/create-project-key-button";
import { KeyList, type KeyItem } from "@/components/key-list";
import { Card, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/format";

export interface ProjectRow {
  id: string;
  name: string;
  monthly_budget: number | null;
  is_active: boolean;
}
export interface ServiceRow {
  id: string;
  name: string;
  cost_per_request: number;
  slug: string | null;
  project_id: string | null;
}
export interface ProjectKeyRow {
  id: string;
  key_prefix: string;
  is_active: boolean;
  project_id: string | null;
  daily_limit: number | null;
}

interface Props {
  projects: ProjectRow[];
  services: ServiceRow[];
  keys: ProjectKeyRow[];
}

export function ProjectsSection({ projects, services, keys }: Props) {
  return (
    <Card className="mb-8">
      <CardTitle className="mb-1">Projects</CardTitle>
      <p className="mb-4 text-sm text-neutral-500">
        Bundle several services under one key. Call them at{" "}
        <code className="text-neutral-400">/v1/proxy/&lt;slug&gt;/…</code>
      </p>

      <CreateProjectForm />

      <div className="mt-6 space-y-6">
        {projects.length === 0 ? (
          <p className="text-sm text-neutral-500">No projects yet.</p>
        ) : (
          projects.map((p) => {
            const projServices = services.filter((s) => s.project_id === p.id);
            const projKeys: KeyItem[] = keys
              .filter((k) => k.project_id === p.id)
              .map((k) => ({ id: k.id, keyPrefix: k.key_prefix, isActive: k.is_active }));

            return (
              <div key={p.id} className="rounded-lg border border-neutral-800 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  {p.monthly_budget != null && (
                    <span className="text-xs tabular-nums text-neutral-400">
                      budget {formatUsd(Number(p.monthly_budget))}/mo
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1">
                  {projServices.length === 0 ? (
                    <p className="text-xs text-neutral-600">No services yet.</p>
                  ) : (
                    projServices.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span className="text-neutral-300">
                          <code className="text-emerald-400">/{s.slug}</code> · {s.name}
                        </span>
                        <span className="tabular-nums text-neutral-500">
                          {formatUsd(Number(s.cost_per_request))}/call
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 border-t border-neutral-800 pt-3">
                  <AddServiceForm projectId={p.id} />
                </div>

                <div className="mt-3 space-y-2 border-t border-neutral-800 pt-3">
                  <KeyList keys={projKeys} />
                  <CreateProjectKeyButton projectId={p.id} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
