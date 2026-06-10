import { AddConnectionForm } from "@/components/add-connection-form";
import { AttachServiceForm } from "@/components/attach-service-form";
import { CreateProjectForm } from "@/components/create-project-form";
import { CreateProjectKeyButton } from "@/components/create-project-key-button";
import { CodeBlock } from "@/components/marketing/code-block";
import { Card, CardTitle } from "@/components/ui/card";
import { PROXY_URL } from "@/lib/proxy-url";

interface ConnOpt {
  id: string;
  name: string;
}
interface Props {
  connections: ConnOpt[];
  firstProject: { id: string; name: string } | null;
  firstSlug: string | null;
}

function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center text-xs font-semibold ${
        done
          ? "btn-accent"
          : active
            ? "neu-sm text-[var(--accent)]"
            : "neu-inset-sm text-[var(--text-faint)]"
      }`}
      aria-hidden
    >
      {done ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        n
      )}
    </span>
  );
}

function Step({
  n,
  done,
  active,
  title,
  children,
}: {
  n: number;
  done: boolean;
  active: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li className={`flex gap-4 ${!done && !active ? "opacity-50" : ""}`}>
      <StepBadge n={n} done={done} active={active} />
      <div className="min-w-0 flex-1 pb-1">
        <p
          className={`pt-1 text-sm font-medium ${
            done ? "text-[var(--text-faint)] line-through" : "text-[var(--text)]"
          }`}
        >
          {title}
        </p>
        {active && children && <div className="mt-3">{children}</div>}
      </div>
    </li>
  );
}

/**
 * First-run guided setup. Shown instead of the Connections/Projects sections
 * until the user mints their first key, walks them to a working proxied call.
 */
export function Onboarding({ connections, firstProject, firstSlug }: Props) {
  const step1Done = connections.length > 0;
  const step2Done = firstProject !== null && firstSlug !== null;
  const step3Active = step1Done && step2Done;

  const curl = `curl ${PROXY_URL}/v1/proxy/${firstSlug ?? "<slug>"}/chat/completions \\
  -H "Authorization: Bearer alw_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "model": "gpt-4o-mini", "messages": [{"role":"user","content":"hi"}] }'`;

  return (
    <Card>
      <CardTitle>Get started</CardTitle>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Three steps to your first capped API call, about two minutes.
      </p>

      <ol className="mt-6 space-y-5">
        <Step n={1} done={step1Done} active={!step1Done} title="Add a connection (the API you already use)">
          <div className="neu-inset p-4">
            <AddConnectionForm />
          </div>
        </Step>

        <Step
          n={2}
          done={step2Done}
          active={step1Done && !step2Done}
          title="Create a project and attach your connection"
        >
          {firstProject === null ? (
            <CreateProjectForm />
          ) : (
            <div>
              <p className="mb-2 text-xs text-[var(--text-faint)]">
                Project <span className="text-[var(--text)]">{firstProject.name}</span>{" "}
                created, now attach your connection under a slug:
              </p>
              <AttachServiceForm projectId={firstProject.id} connections={connections} />
            </div>
          )}
        </Step>

        <Step n={3} done={false} active={step3Active} title="Mint a key and make your first call">
          {firstProject && (
            <div className="space-y-3">
              <CreateProjectKeyButton
                projectId={firstProject.id}
                testSlug={firstSlug}
              />
              <p className="text-xs text-[var(--text-faint)]">
                Copy the key (shown once), then drop it into this call:
              </p>
              <CodeBlock label="your first call" code={curl} />
            </div>
          )}
        </Step>
      </ol>
    </Card>
  );
}
