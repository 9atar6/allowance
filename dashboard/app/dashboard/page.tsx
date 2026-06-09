import { ActivityTable, type ActivityRow } from "@/components/activity-table";
import { CreateKeyButton } from "@/components/create-key-button";
import { EndpointToggle } from "@/components/endpoint-toggle";
import { InlineDelete } from "@/components/inline-delete";
import { KeyList } from "@/components/key-list";
import { PlanCard } from "@/components/plan-card";
import { ProjectsSection, type ProjectRow } from "@/components/projects-section";
import { ThemeToggle } from "@/components/theme-toggle";
import { TopUp } from "@/components/top-up";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatUsd as usd } from "@/lib/format";
import { monthlyQuota, type PlanTier } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { deleteService, signOut } from "./actions";

interface Endpoint {
  id: string;
  name: string;
  target_url: string;
  cost_per_request: number;
  is_active: boolean;
  project_id: string | null;
  slug: string | null;
}
interface ProxyKey {
  id: string;
  key_prefix: string;
  is_active: boolean;
  endpoint_id: string | null;
  project_id: string | null;
  daily_limit: number | null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string; plan?: string }>;
}) {
  const { topup, plan: planParam } = await searchParams;
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();

  // All reads are RLS-scoped to the signed-in user.
  const [
    { data: wallet },
    { data: endpoints },
    { data: keys },
    { data: usage },
    { data: txns },
    { data: projects },
    { count: monthlyCount },
  ] = await Promise.all([
    supabase
      .from("wallets")
      .select("balance, currency, plan, current_period_end")
      .single(),
    supabase
      .from("endpoints")
      .select("id, name, target_url, cost_per_request, is_active, project_id, slug")
      .order("created_at", { ascending: false }),
    supabase
      .from("proxy_keys")
      .select("id, key_prefix, is_active, endpoint_id, project_id, daily_limit")
      .order("created_at", { ascending: false }),
    // Request-level detail, used to enrich debit rows in the activity feed.
    supabase
      .from("usage_events")
      .select("request_id, endpoint_id, status_code")
      .order("created_at", { ascending: false })
      .limit(200),
    // The money ledger — the spine of the activity feed.
    supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, created_at, external_ref, metadata")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("projects")
      .select("id, name, monthly_budget, is_active")
      .order("created_at", { ascending: false }),
    supabase
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart),
  ]);

  const balance = wallet?.balance ?? 0;
  const plan = ((wallet?.plan as PlanTier | undefined) ?? "free") as PlanTier;
  const periodEnd = (wallet?.current_period_end as string | null) ?? null;
  const monthlyUsed = monthlyCount ?? 0;
  const monthlyLimit = monthlyQuota(plan);
  const endpointList = (endpoints ?? []) as Endpoint[];
  const keyList = (keys ?? []) as ProxyKey[];
  const projectList = (projects ?? []) as ProjectRow[];
  const standaloneEndpoints = endpointList.filter((e) => !e.project_id);
  const endpointNames = new Map(endpointList.map((e) => [e.id, e.name]));

  // Map request_id → request detail, to enrich debit rows.
  const usageByReq = new Map<string, { status: number | null; endpointId: string | null }>();
  for (const u of usage ?? []) {
    if (u.request_id) {
      usageByReq.set(u.request_id as string, {
        status: u.status_code as number | null,
        endpointId: u.endpoint_id as string | null,
      });
    }
  }

  // One ledger: top-ups (credits) + per-call charges (debits), newest first.
  const activityRows: ActivityRow[] = (txns ?? []).map((t) => {
    const amount = Number(t.amount);
    const credit = amount >= 0;
    const ref = (t.external_ref as string | null) ?? null;
    const u = ref ? usageByReq.get(ref) : undefined;
    const meta = (t.metadata ?? {}) as { endpoint_id?: string };
    const endpointId = meta.endpoint_id ?? u?.endpointId ?? null;
    const label = credit
      ? "Top-up"
      : (endpointId && endpointNames.get(endpointId)) || "Request";
    return {
      id: t.id as string,
      createdAt: t.created_at as string,
      label,
      status: u?.status ?? null,
      amount,
      balanceAfter: Number(t.balance_after),
    };
  });

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 pb-20">
      {/* Top bar */}
      <header className="flex items-center justify-between py-7">
        <span className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <span className="neu-sm grid h-7 w-7 place-items-center text-[13px] text-accent">
            A
          </span>
          Allowance
        </span>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 text-xs font-medium ${
              plan === "free"
                ? "neu-inset-sm text-[var(--text-muted)]"
                : "btn-accent"
            }`}
          >
            {plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Enterprise"}
          </span>
          <ThemeToggle />
          <form action={signOut}>
            <Button variant="ghost" type="submit" className="px-3 py-2 text-xs">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {/* Account: Balance + Plan share one panel, actions pinned to the bottom */}
      <Card className="grid gap-0 md:grid-cols-2">
        {/* Balance */}
        <div className="flex flex-col pb-6 md:pb-0 md:pr-8">
          <CardTitle>Balance</CardTitle>
          <p className="mt-3 text-5xl font-semibold tracking-tight tabular-nums">
            {usd(Number(balance))}
          </p>
          <p className="mt-2 text-xs text-[var(--text-faint)]">
            Calls stop with HTTP 402 when this reaches zero.
          </p>
          <div className="mt-auto pt-6">
            <TopUp />
            {topup === "success" && (
              <p className="mt-2.5 text-sm text-accent">
                Payment received. Balance updates within a few seconds.
              </p>
            )}
            {topup === "cancelled" && (
              <p className="mt-2.5 text-sm text-[var(--text-muted)]">
                Top-up cancelled.
              </p>
            )}
          </div>
        </div>

        {/* Plan */}
        <div className="flex flex-col border-t border-white/5 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <PlanCard
            plan={plan}
            used={monthlyUsed}
            limit={monthlyLimit}
            periodEnd={periodEnd}
          />
          {planParam === "upgraded" && (
            <p className="mt-2.5 text-sm text-accent">
              You are on Pro. Thanks for the support.
            </p>
          )}
          {planParam === "cancelled" && (
            <p className="mt-2.5 text-sm text-[var(--text-muted)]">
              Upgrade cancelled.
            </p>
          )}
        </div>
      </Card>

      {/* Projects */}
      <ProjectsSection
        projects={projectList}
        services={endpointList}
        keys={keyList}
      />

      {/* Ungrouped (legacy single-endpoint) services, only if any */}
      {standaloneEndpoints.length > 0 && (
        <Card>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Ungrouped services ({standaloneEndpoints.length})
            </summary>
            <p className="mb-3 mt-1 text-xs text-[var(--text-faint)]">
              Single services not in a project. New services are best added
              inside a project above.
            </p>
            <ul className="space-y-3">
              {standaloneEndpoints.map((e) => {
                const endpointKeys = keyList
                  .filter((k) => k.endpoint_id === e.id)
                  .map((k) => ({
                    id: k.id,
                    keyPrefix: k.key_prefix,
                    isActive: k.is_active,
                    dailyLimit: k.daily_limit,
                  }));
                return (
                  <li
                    key={e.id}
                    className={`neu-inset p-4 ${e.is_active ? "" : "opacity-60"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{e.name}</p>
                        <p className="truncate font-mono text-xs text-[var(--text-faint)]">
                          {e.target_url}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs tabular-nums text-[var(--text-muted)]">
                          {usd(Number(e.cost_per_request))}/call
                        </span>
                        <EndpointToggle endpointId={e.id} isActive={e.is_active} />
                        <InlineDelete action={deleteService.bind(null, e.id)} label="delete" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                      <KeyList keys={endpointKeys} />
                      <CreateKeyButton endpointId={e.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        </Card>
      )}

      {/* Activity: one ledger of top-ups + per-call charges */}
      <Card>
        <CardTitle className="mb-4">Activity</CardTitle>
        <ActivityTable rows={activityRows} />
      </Card>
    </main>
  );
}
