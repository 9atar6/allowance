import { ActivityTable, type ActivityRow } from "@/components/activity-table";
import { CreateKeyButton } from "@/components/create-key-button";
import { EndpointToggle } from "@/components/endpoint-toggle";
import { InlineDelete } from "@/components/inline-delete";
import { KeyList } from "@/components/key-list";
import { AutoReloadSetting } from "@/components/auto-reload-setting";
import { CollapsibleCard } from "@/components/collapsible-card";
import { LowBalanceSetting } from "@/components/low-balance-setting";
import { PlanCard } from "@/components/plan-card";
import { ProjectsSection, type ProjectRow } from "@/components/projects-section";
import { ThemeToggle } from "@/components/theme-toggle";
import { TopUp } from "@/components/top-up";
import {
  UsageAnalytics,
  type DailyPoint,
  type ServicePoint,
} from "@/components/usage-analytics";
import { Wordmark } from "@/components/wordmark";
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
  name: string | null;
  created_at: string | null;
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
    { data: dailyRaw },
    { data: serviceRaw },
  ] = await Promise.all([
    supabase
      .from("wallets")
      .select(
        "balance, currency, plan, current_period_end, low_balance_threshold, auto_reload_enabled, auto_reload_amount",
      )
      .single(),
    supabase
      .from("endpoints")
      .select("id, name, target_url, cost_per_request, is_active, project_id, slug")
      .order("created_at", { ascending: false }),
    supabase
      .from("proxy_keys")
      .select("id, key_prefix, is_active, endpoint_id, project_id, daily_limit, name, created_at")
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
    supabase.rpc("my_daily_usage", { p_days: 14 }),
    supabase.rpc("my_service_usage", { p_days: 30 }),
  ]);

  const balance = wallet?.balance ?? 0;
  const plan = ((wallet?.plan as PlanTier | undefined) ?? "free") as PlanTier;
  const periodEnd = (wallet?.current_period_end as string | null) ?? null;
  const lowThreshold =
    wallet?.low_balance_threshold != null
      ? Number(wallet.low_balance_threshold)
      : null;
  const autoReloadEnabled = Boolean(wallet?.auto_reload_enabled);
  const autoReloadAmount =
    wallet?.auto_reload_amount != null ? Number(wallet.auto_reload_amount) : null;
  const monthlyUsed = monthlyCount ?? 0;
  const monthlyLimit = monthlyQuota(plan);
  const endpointList = (endpoints ?? []) as Endpoint[];
  const keyList = (keys ?? []) as ProxyKey[];
  const projectList = (projects ?? []) as ProjectRow[];
  const standaloneEndpoints = endpointList.filter((e) => !e.project_id);
  const endpointNames = new Map(endpointList.map((e) => [e.id, e.name]));
  const isPro = plan !== "free";
  const serviceName = (id: string | null) =>
    (id && endpointNames.get(id)) || "Unknown";

  // Fill a continuous 14-day window for the chart (RPC only returns active days).
  const dailyMap = new Map<string, { requests: number; cost: number }>();
  for (const r of (dailyRaw ?? []) as { day: string; requests: number; cost: number }[]) {
    dailyMap.set(r.day, { requests: Number(r.requests), cost: Number(r.cost) });
  }
  const daily: DailyPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    const key = d.toISOString().slice(0, 10);
    const hit = dailyMap.get(key);
    daily.push({ day: key, requests: hit?.requests ?? 0, cost: hit?.cost ?? 0 });
  }
  const serviceRows: ServicePoint[] = (
    (serviceRaw ?? []) as { endpoint_id: string | null; requests: number; cost: number }[]
  ).map((s) => ({
    endpointId: s.endpoint_id,
    requests: Number(s.requests),
    cost: Number(s.cost),
  }));

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
        <Wordmark />
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
      <CollapsibleCard title="Account">
        <div className="grid gap-0 md:grid-cols-2">
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
            <LowBalanceSetting current={lowThreshold} />
            <AutoReloadSetting
              enabled={autoReloadEnabled}
              amount={autoReloadAmount}
            />
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
        </div>
      </CollapsibleCard>

      {/* Projects */}
      <CollapsibleCard title="Projects">
        <ProjectsSection
          projects={projectList}
          services={endpointList}
          keys={keyList}
        />
      </CollapsibleCard>

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
                    name: k.name,
                    createdAt: k.created_at,
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

      {/* Usage analytics (Pro) */}
      <CollapsibleCard
        title="Usage analytics"
        aside={!isPro ? "Pro" : undefined}
      >
        {isPro ? (
          <UsageAnalytics
            daily={daily}
            services={serviceRows}
            serviceName={serviceName}
          />
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Daily spend, request trends, and per-service breakdowns — upgrade to
            Pro to unlock.
          </p>
        )}
      </CollapsibleCard>

      {/* Activity: one ledger of top-ups + per-call charges */}
      <CollapsibleCard title="Activity">
        <ActivityTable rows={activityRows} />
      </CollapsibleCard>
    </main>
  );
}
