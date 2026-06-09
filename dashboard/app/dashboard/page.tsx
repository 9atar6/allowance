import { ActivityTable, type ActivityRow } from "@/components/activity-table";
import { CollapsibleCard } from "@/components/collapsible-card";
import {
  ConnectionsSection,
  type ConnectionRow,
} from "@/components/connections-section";
import { LowBalanceSetting } from "@/components/low-balance-setting";
import { PlanCard } from "@/components/plan-card";
import {
  ProjectsSection,
  type AttachmentRow,
  type ConnectionOption,
  type ProjectRow,
} from "@/components/projects-section";
import { SetBudget } from "@/components/set-budget";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  UsageAnalytics,
  type DailyPoint,
  type ServicePoint,
} from "@/components/usage-analytics";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { formatUsd as usd } from "@/lib/format";
import { monthlyQuota, type PlanTier } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

interface Endpoint {
  id: string;
  name: string;
  target_url: string;
  cost_per_request: number;
  is_active: boolean;
  metering_mode: string | null;
}
interface ProjectServiceRow {
  id: string;
  project_id: string;
  slug: string;
  endpoints: {
    id: string;
    name: string;
    target_url: string;
    cost_per_request: number;
    metering_mode: string | null;
  } | null;
}
interface ProxyKey {
  id: string;
  key_prefix: string;
  is_active: boolean;
  endpoint_id: string | null;
  project_id: string | null;
  daily_limit: number | null;
  monthly_limit: number | null;
  name: string | null;
  created_at: string | null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string; plan?: string }>;
}) {
  const { plan: planParam } = await searchParams;
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
    { data: projectServices },
    { count: monthlyCount },
    { data: dailyRaw },
    { data: serviceRaw },
  ] = await Promise.all([
    supabase
      .from("wallets")
      .select(
        "balance, currency, plan, current_period_end, low_balance_threshold",
      )
      .single(),
    supabase
      .from("endpoints")
      .select("id, name, target_url, cost_per_request, is_active, metering_mode")
      .order("created_at", { ascending: false }),
    supabase
      .from("proxy_keys")
      .select("id, key_prefix, is_active, endpoint_id, project_id, daily_limit, monthly_limit, name, created_at")
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
      .limit(50),
    supabase
      .from("projects")
      .select("id, name, monthly_budget, is_active")
      .order("created_at", { ascending: false }),
    // Attached services = connections mapped into projects with a slug.
    supabase
      .from("project_services")
      .select(
        "id, project_id, slug, endpoints ( id, name, target_url, cost_per_request, metering_mode )",
      )
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
  const monthlyUsed = monthlyCount ?? 0;
  const monthlyLimit = monthlyQuota(plan);
  const endpointList = (endpoints ?? []) as Endpoint[];
  const keyList = (keys ?? []) as ProxyKey[];
  const projectList = (projects ?? []) as ProjectRow[];
  const endpointNames = new Map(endpointList.map((e) => [e.id, e.name]));

  // Connections (reusable APIs) = the endpoints list.
  const connections: ConnectionRow[] = endpointList.map((e) => ({
    id: e.id,
    name: e.name,
    target_url: e.target_url,
    cost_per_request: Number(e.cost_per_request),
    metering_mode: e.metering_mode,
  }));
  const connectionOptions: ConnectionOption[] = endpointList.map((e) => ({
    id: e.id,
    name: e.name,
  }));

  // Attachments (a connection mapped into a project under a slug).
  const attachments: AttachmentRow[] = (
    (projectServices ?? []) as unknown as ProjectServiceRow[]
  )
    .map((ps) => {
      const ep = Array.isArray(ps.endpoints) ? ps.endpoints[0] : ps.endpoints;
      if (!ep) return null;
      return {
        id: ps.id,
        project_id: ps.project_id,
        slug: ps.slug,
        endpointName: ep.name,
        endpointUrl: ep.target_url,
        endpointCost: Number(ep.cost_per_request),
        meteringMode: ep.metering_mode,
      };
    })
    .filter((a): a is AttachmentRow => a !== null);
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
        {/* Budget (a free spend cap — your providers still bill you directly) */}
        <div className="flex flex-col pb-6 md:pb-0 md:pr-8">
          <CardTitle>Budget left</CardTitle>
          <p className="mt-3 text-5xl font-semibold tracking-tight tabular-nums">
            {usd(Number(balance))}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-faint)]">
            A free cap you set — your providers still bill you directly, we never
            charge for usage. Calls stop with HTTP 402 when it reaches zero.
          </p>
          <div className="mt-auto pt-6">
            <SetBudget current={Number(balance)} />
            <LowBalanceSetting current={lowThreshold} />
          </div>
        </div>

        {/* Plan */}
        <div className="flex flex-col border-t border-[var(--line)] pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
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

      {/* Connections (reusable APIs) — define an API first, then attach it */}
      <CollapsibleCard title="Connections">
        <ConnectionsSection connections={connections} />
      </CollapsibleCard>

      {/* Projects — attach connections + mint keys */}
      <CollapsibleCard title="Projects">
        <ProjectsSection
          projects={projectList}
          attachments={attachments}
          connections={connectionOptions}
          keys={keyList}
        />
      </CollapsibleCard>

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

      {/* Activity: one ledger of top-ups + per-call charges (scrolls if long) */}
      <CollapsibleCard title="Activity">
        <div className="max-h-96 overflow-y-auto pr-1">
          <ActivityTable rows={activityRows} />
        </div>
      </CollapsibleCard>
    </main>
  );
}
