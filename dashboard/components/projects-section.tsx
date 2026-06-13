import { deleteProject, detachService } from "@/app/dashboard/actions";
import { AttachServiceForm } from "@/components/attach-service-form";
import { CreateProjectForm } from "@/components/create-project-form";
import { CreateProjectKeyButton } from "@/components/create-project-key-button";
import { InlineDelete } from "@/components/inline-delete";
import { KeyList, type KeyItem } from "@/components/key-list";
import { formatUsd } from "@/lib/format";

export interface ProjectRow {
  id: string;
  name: string;
  monthly_budget: number | null;
  is_active: boolean;
}
export interface AttachmentRow {
  id: string; // project_services id
  project_id: string;
  slug: string;
  endpointName: string;
  endpointUrl: string;
  endpointCost: number;
  meteringMode: string | null;
}
export interface ConnectionOption {
  id: string;
  name: string;
}
export interface ProjectKeyRow {
  id: string;
  key_prefix: string;
  is_active: boolean;
  project_id: string | null;
  daily_limit: number | null;
  monthly_limit: number | null;
  name: string | null;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  parent_key_id: string | null;
  budget_limit: number | null;
}

interface Props {
  projects: ProjectRow[];
  attachments: AttachmentRow[];
  connections: ConnectionOption[];
  keys: ProjectKeyRow[];
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-faint)]">
      {children}
    </p>
  );
}

export function ProjectsSection({
  projects,
  attachments,
  connections,
  keys,
}: Props) {
  return (
    <div>
      <p className="text-xs text-[var(--text-faint)]">
        One key per project. Agents call services at{" "}
        <code className="font-mono text-[var(--text-muted)]">
          /v1/proxy/&lt;slug&gt;
        </code>
      </p>

      <div className="mt-4">
        <CreateProjectForm />
      </div>

      <div className="mt-6 space-y-5">
        {projects.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">
            No projects yet. Create one above to get started.
          </p>
        ) : (
          projects.map((p) => {
            const projAttachments = attachments.filter(
              (a) => a.project_id === p.id,
            );
            const projKeys: KeyItem[] = keys
              .filter((k) => k.project_id === p.id)
              .map((k) => ({
                id: k.id,
                keyPrefix: k.key_prefix,
                isActive: k.is_active,
                dailyLimit: k.daily_limit,
                monthlyLimit: k.monthly_limit,
                name: k.name,
                createdAt: k.created_at,
                lastUsedAt: k.last_used_at,
                expiresAt: k.expires_at,
                parentKeyId: k.parent_key_id,
                budgetLimit: k.budget_limit,
              }));
            // Group child keys directly under their parent (parents keep their
            // created-desc order; orphans fall through at the end).
            const parents = projKeys.filter((k) => !k.parentKeyId);
            const childrenOf = (id: string) =>
              projKeys.filter((k) => k.parentKeyId === id);
            const orderedKeys: KeyItem[] = [
              ...parents.flatMap((p) => [p, ...childrenOf(p.id)]),
              ...projKeys.filter(
                (k) => k.parentKeyId && !parents.some((p) => p.id === k.parentKeyId),
              ),
            ];

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

                {/* Services (attached connections) */}
                <div className="mt-5 border-t border-[var(--line)] pt-5">
                  <GroupLabel>Services</GroupLabel>
                  {projAttachments.length === 0 ? (
                    <p className="text-xs text-[var(--text-faint)]">
                      No services attached yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {projAttachments.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <code className="neu-sm shrink-0 px-2 py-0.5 font-mono text-[var(--accent)]">
                              /{a.slug}
                            </code>
                            <span className="text-[var(--text)]">
                              {a.endpointName}
                            </span>
                            <span className="truncate font-mono text-[var(--text-faint)]">
                              {a.endpointUrl}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="tabular-nums text-[var(--text-faint)]">
                              {a.meteringMode === "per_token"
                                ? "per-token"
                                : `${formatUsd(Number(a.endpointCost))}/call`}
                            </span>
                            <InlineDelete
                              action={detachService.bind(null, a.id)}
                              label="detach"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <details className="group mt-3">
                    <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--accent)]">
                      <svg className="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                      Attach a service
                    </summary>
                    <div className="mt-3">
                      <AttachServiceForm projectId={p.id} connections={connections} />
                    </div>
                  </details>
                </div>

                {/* Keys */}
                <div className="mt-5 border-t border-[var(--line)] pt-5">
                  <GroupLabel>Keys</GroupLabel>
                  <KeyList keys={orderedKeys} />
                  <div className="mt-3">
                    <CreateProjectKeyButton
                      projectId={p.id}
                      testSlug={projAttachments[0]?.slug ?? null}
                    />
                    <p className="mt-1.5 text-xs text-[var(--text-faint)]">
                      Optional: cap how much each key can spend per day and per
                      month.
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
