import { deleteConnection } from "@/app/dashboard/actions";
import { AddConnectionForm } from "@/components/add-connection-form";
import { InlineDelete } from "@/components/inline-delete";
import { formatUsd } from "@/lib/format";

export interface ConnectionRow {
  id: string;
  name: string;
  target_url: string;
  cost_per_request: number;
  metering_mode: string | null;
}

export function ConnectionsSection({
  connections,
}: {
  connections: ConnectionRow[];
}) {
  return (
    <div>
      <p className="text-xs text-[var(--text-faint)]">
        Define an API once, then attach it to any project. Credentials are vaulted
        and never leave Allowance.
      </p>

      <div className="mt-4 space-y-2">
        {connections.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">
            No connections yet. Add one below.
          </p>
        ) : (
          connections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 neu-inset px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text)]">{c.name}</p>
                <p className="truncate font-mono text-xs text-[var(--text-faint)]">
                  {c.target_url}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <span className="tabular-nums text-[var(--text-faint)]">
                  {c.metering_mode === "per_token"
                    ? "per-token"
                    : `${formatUsd(Number(c.cost_per_request))}/call`}
                </span>
                <InlineDelete
                  action={deleteConnection.bind(null, c.id)}
                  label="delete"
                />
              </div>
            </div>
          ))
        )}
      </div>

      <details className="mt-4">
        <summary className="inline-flex cursor-pointer text-xs font-medium text-[var(--accent)]">
          + Add a connection
        </summary>
        <div className="neu mt-3 p-4">
          <AddConnectionForm />
        </div>
      </details>
    </div>
  );
}
