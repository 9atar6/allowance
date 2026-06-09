import { deleteProject, deleteService } from "@/app/dashboard/actions";
import { AddServiceForm } from "@/components/add-service-form";
import { CreateProjectForm } from "@/components/create-project-form";
import { CreateProjectKeyButton } from "@/components/create-project-key-button";
import { InlineDelete } from "@/components/inline-delete";
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
  target_url: string;
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
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <CardTitle>Projects</CardTitle>
      </div>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Group services under one key. Agents call them at{" "}
        <code className="font-mono text-[var(--accent)]">
          /v1/proxy/&lt;slug&gt;/…
        </code>
      </p>

      <CreateProjectForm />

      <div className="mt-6 space-y-4">
        {projects.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">No projects yet.</p>
        ) : (
          projects.map((p) => {
            const projServices = services.filter((s) => s.project_id === p.id);
            const projKeys: KeyItem[] = keys
              .filter((k) => k.project_id === p.id)
              .map((k) => ({
                id: k.id,
                keyPrefix: k.key_prefix,
                isActive: k.is_active,
                dailyLimit: k.daily_limit,
              }));

            return (
              <div key={p.id} className="neu-inset p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-3">
                    {p.monthly_budget != null && (
                      <span className="text-xs tabular-nums text-[var(--text-muted)]">
                        {formatUsd(Number(p.monthly_budget))}/mo cap
                      </span>
                    )}
                    <InlineDelete action={deleteProject.bind(null, p.id)} label="Delete" />
                  </div>
                </div>

                {/* Services */}
                <div className="mt-3 space-y-1.5">
                  {projServices.length === 0 ? (
                    <p className="text-xs text-[var(--text-faint)]">
                      No services yet.
                    </p>
                  ) : (
                    projServices.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <code className="font-mono text-[var(--accent)]">
                            /{s.slug}
                          </code>
                          <span className="ml-2 text-[var(--text)]">{s.name}</span>
                          <span className="ml-2 truncate font-mono text-[var(--text-faint)]">
                            {s.target_url}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="tabular-nums text-[var(--text-faint)]">
                            {formatUsd(Number(s.cost_per_request))}/call
                          </span>
                          <InlineDelete action={deleteService.bind(null, s.id)} label="remove" />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add a service (collapsed to stay compact) */}
                <details className="mt-3 border-t border-white/5 pt-3">
                  <summary className="cursor-pointer text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
                    + Add a service
                  </summary>
                  <div className="mt-3">
                    <AddServiceForm projectId={p.id} />
                  </div>
                </details>

                {/* Keys */}
                <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
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
