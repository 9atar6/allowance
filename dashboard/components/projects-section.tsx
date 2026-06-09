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

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-faint)]">
      {children}
    </p>
  );
}

export function ProjectsSection({ projects, services, keys }: Props) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <CardTitle>Projects</CardTitle>
        <p className="text-xs text-[var(--text-faint)]">
          One key per project. Agents call services at{" "}
          <code className="font-mono text-[var(--text-muted)]">
            /v1/proxy/&lt;slug&gt;
          </code>
        </p>
      </div>

      <div className="mt-4">
        <CreateProjectForm />
      </div>

      <div className="mt-6 space-y-4">
        {projects.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">
            No projects yet. Create one above to get started.
          </p>
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
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-3">
                    {p.monthly_budget != null && (
                      <span className="text-xs tabular-nums text-[var(--text-faint)]">
                        {formatUsd(Number(p.monthly_budget))}/mo cap
                      </span>
                    )}
                    <InlineDelete
                      action={deleteProject.bind(null, p.id)}
                      label="Delete"
                    />
                  </div>
                </div>

                {/* Services */}
                <div className="mt-4 border-t border-white/5 pt-4">
                  <GroupLabel>Services</GroupLabel>
                  {projServices.length === 0 ? (
                    <p className="text-xs text-[var(--text-faint)]">
                      No services yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {projServices.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <code className="neu-sm shrink-0 px-2 py-0.5 font-mono text-[var(--accent)]">
                              /{s.slug}
                            </code>
                            <span className="text-[var(--text)]">{s.name}</span>
                            <span className="truncate font-mono text-[var(--text-faint)]">
                              {s.target_url}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="tabular-nums text-[var(--text-faint)]">
                              {formatUsd(Number(s.cost_per_request))}/call
                            </span>
                            <InlineDelete
                              action={deleteService.bind(null, s.id)}
                              label="remove"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <details className="mt-3">
                    <summary className="inline-flex cursor-pointer text-xs font-medium text-[var(--accent)]">
                      + Add a service
                    </summary>
                    <div className="neu mt-3 p-4">
                      <AddServiceForm projectId={p.id} />
                    </div>
                  </details>
                </div>

                {/* Keys */}
                <div className="mt-4 border-t border-white/5 pt-4">
                  <GroupLabel>Keys</GroupLabel>
                  <KeyList keys={projKeys} />
                  <div className="mt-3">
                    <CreateProjectKeyButton projectId={p.id} />
                    <p className="mt-1.5 text-xs text-[var(--text-faint)]">
                      Optional: cap how much each key can spend per day.
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
