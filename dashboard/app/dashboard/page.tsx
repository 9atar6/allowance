import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateKeyButton } from "@/components/create-key-button";
import { EndpointToggle } from "@/components/endpoint-toggle";
import { InlineDelete } from "@/components/inline-delete";
import { KeyList } from "@/components/key-list";
import { ProjectsSection, type ProjectRow } from "@/components/projects-section";
import { TopUp } from "@/components/top-up";
import { TransactionsTable, type TxnRow } from "@/components/transactions-table";
import { UsageTable, type UsageRow } from "@/components/usage-table";
import { formatUsd as usd } from "@/lib/format";
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
  searchParams: Promise<{ topup?: string }>;
}) {
  const { topup } = await searchParams;
  const supabase = await createClient();

  // All reads are RLS-scoped to the signed-in user.
  const [
    { data: wallet },
    { data: endpoints },
    { data: keys },
    { data: usage },
    { data: txns },
    { data: projects },
  ] = await Promise.all([
    supabase.from("wallets").select("balance, currency").single(),
    supabase
      .from("endpoints")
      .select("id, name, target_url, cost_per_request, is_active, project_id, slug")
      .order("created_at", { ascending: false }),
    supabase
      .from("proxy_keys")
      .select("id, key_prefix, is_active, endpoint_id, project_id, daily_limit")
      .order("created_at", { ascending: false }),
    supabase
      .from("usage_events")
      .select("id, endpoint_id, cost, status_code, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("projects")
      .select("id, name, monthly_budget, is_active")
      .order("created_at", { ascending: false }),
  ]);

  const balance = wallet?.balance ?? 0;
  const endpointList = (endpoints ?? []) as Endpoint[];
  const keyList = (keys ?? []) as ProxyKey[];
  const projectList = (projects ?? []) as ProjectRow[];

  // Standalone endpoints/keys (not tied to a project) for the simple section.
  const standaloneEndpoints = endpointList.filter((e) => !e.project_id);

  // Map raw rows → typed view models (numeric columns can arrive as strings).
  const endpointNames = new Map(endpointList.map((e) => [e.id, e.name]));
  const endpointName = (id: string | null) =>
    (id && endpointNames.get(id)) || "-";

  const usageRows: UsageRow[] = (usage ?? []).map((u) => ({
    id: u.id as string,
    endpointId: u.endpoint_id as string | null,
    cost: Number(u.cost),
    statusCode: u.status_code as number | null,
    createdAt: u.created_at as string,
  }));

  const txnRows: TxnRow[] = (txns ?? []).map((t) => ({
    id: t.id as string,
    type: t.type as string,
    amount: Number(t.amount),
    balanceAfter: Number(t.balance_after),
    createdAt: t.created_at as string,
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Allowance</h1>
        <form action={signOut}>
          <Button variant="ghost" type="submit" className="text-xs">
            Sign out
          </Button>
        </form>
      </header>

      {/* Balance + top-up */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <CardTitle>Balance</CardTitle>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-white">
              {usd(Number(balance))}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Calls stop with HTTP 402 when this reaches zero.
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <TopUp />
          </div>
        </div>
        {topup === "success" && (
          <p className="mt-3 text-sm text-green-400">
            Payment received. Your balance updates within a few seconds.
          </p>
        )}
        {topup === "cancelled" && (
          <p className="mt-3 text-sm text-neutral-400">Top-up cancelled.</p>
        )}
      </Card>

      {/* Projects: the main way to add services + keys */}
      <ProjectsSection
        projects={projectList}
        services={endpointList}
        keys={keyList}
      />

      {/* Ungrouped (legacy single-endpoint) services, collapsed, only if any */}
      {standaloneEndpoints.length > 0 && (
        <Card>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-white">
              Ungrouped services ({standaloneEndpoints.length})
            </summary>
            <p className="mb-3 mt-1 text-xs text-neutral-500">
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
                    className={`rounded-lg border border-neutral-800 p-3 ${
                      e.is_active ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{e.name}</p>
                        <p className="truncate text-xs text-neutral-600">
                          {e.target_url}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs tabular-nums text-neutral-400">
                          {usd(Number(e.cost_per_request))}/call
                        </span>
                        <EndpointToggle endpointId={e.id} isActive={e.is_active} />
                        <InlineDelete action={deleteService.bind(null, e.id)} label="delete" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-800 pt-2">
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

      {/* Activity: usage + transactions side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardTitle className="mb-3">Recent usage</CardTitle>
          <UsageTable rows={usageRows} endpointName={endpointName} />
        </Card>
        <Card>
          <CardTitle className="mb-3">Transactions</CardTitle>
          <TransactionsTable rows={txnRows} />
        </Card>
      </div>
    </main>
  );
}
