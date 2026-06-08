import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddEndpointForm } from "@/components/add-endpoint-form";
import { CreateKeyButton } from "@/components/create-key-button";
import { EndpointToggle } from "@/components/endpoint-toggle";
import { KeyList } from "@/components/key-list";
import { ProjectsSection, type ProjectRow } from "@/components/projects-section";
import { TopUp } from "@/components/top-up";
import { TransactionsTable, type TxnRow } from "@/components/transactions-table";
import { UsageTable, type UsageRow } from "@/components/usage-table";
import { formatUsd as usd } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

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
      .limit(20),
    supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Allowance</h1>
        <form action={signOut}>
          <Button variant="ghost" type="submit" className="text-xs">
            Sign out
          </Button>
        </form>
      </header>

      {/* Balance + top-up */}
      <Card className="mb-8">
        <CardTitle>Prepaid balance</CardTitle>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
          {usd(Number(balance))}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Requests hard-stop with HTTP 402 when this hits zero.
        </p>
        {topup === "success" && (
          <p className="mt-3 text-sm text-green-400">
            Payment received. Your balance updates within a few seconds.
          </p>
        )}
        {topup === "cancelled" && (
          <p className="mt-3 text-sm text-neutral-400">Top-up cancelled.</p>
        )}
        <TopUp />
      </Card>

      {/* Projects (one key, many services) */}
      <ProjectsSection
        projects={projectList}
        services={endpointList}
        keys={keyList}
      />

      {/* Add a standalone endpoint */}
      <Card className="mb-8">
        <CardTitle className="mb-4">Add a standalone service</CardTitle>
        <AddEndpointForm />
      </Card>

      {/* Standalone endpoints + keys */}
      <Card>
        <CardTitle className="mb-4">Standalone services</CardTitle>
        {standaloneEndpoints.length === 0 ? (
          <p className="text-sm text-neutral-500">No standalone services yet.</p>
        ) : (
          <ul className="space-y-4">
            {standaloneEndpoints.map((e) => {
              const endpointKeys = keyList
                .filter((k) => k.endpoint_id === e.id)
                .map((k) => ({
                  id: k.id,
                  keyPrefix: k.key_prefix,
                  isActive: k.is_active,
                }));
              return (
                <li
                  key={e.id}
                  className={`rounded-lg border border-neutral-800 p-4 ${
                    e.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{e.name}</p>
                      <p className="text-xs text-neutral-500">{e.target_url}</p>
                    </div>
                    <span className="text-xs tabular-nums text-neutral-400">
                      {usd(Number(e.cost_per_request))}/call
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <EndpointToggle endpointId={e.id} isActive={e.is_active} />
                    <CreateKeyButton endpointId={e.id} />
                  </div>

                  <div className="mt-3 border-t border-neutral-800 pt-3">
                    <KeyList keys={endpointKeys} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Recent usage */}
      <Card className="mt-8">
        <CardTitle className="mb-4">Recent usage</CardTitle>
        <UsageTable rows={usageRows} endpointName={endpointName} />
      </Card>

      {/* Transactions */}
      <Card className="mt-8">
        <CardTitle className="mb-4">Transactions</CardTitle>
        <TransactionsTable rows={txnRows} />
      </Card>
    </main>
  );
}
