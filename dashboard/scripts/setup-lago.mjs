// One-time Lago setup: creates the billable metric + plan the app expects.
// Run once per Lago environment:
//   LAGO_API_URL=... LAGO_API_KEY=... node scripts/setup-lago.mjs
//
// The metric code ("api_call") MUST match the worker's LAGO_EVENT_CODE, and the
// plan code MUST match LAGO_PLAN_CODE used by lib/lago.ts.

const URL = process.env.LAGO_API_URL || "https://api.getlago.com";
const KEY = process.env.LAGO_API_KEY;
const METRIC_CODE = process.env.LAGO_EVENT_CODE || "api_call";
const PLAN_CODE = process.env.LAGO_PLAN_CODE || "api_wallet_usage";

if (!KEY) {
  console.error("LAGO_API_KEY is required");
  process.exit(1);
}

async function post(path, body) {
  const res = await fetch(`${URL}/api/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // 422 typically means "already exists" — treat as non-fatal for idempotency.
  if (!res.ok && res.status !== 422) {
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return { status: res.status, body: text };
}

async function main() {
  // 1. Billable metric — count of API calls.
  const metric = await post("/billable_metrics", {
    billable_metric: {
      name: "API Calls",
      code: METRIC_CODE,
      aggregation_type: "count_agg",
      recurring: false,
    },
  });
  console.log(`billable_metric(${METRIC_CODE}) → ${metric.status}`);

  // 2. Plan — monthly, with a usage charge on that metric (standard model,
  //    $0 here since real charging is prepaid in our own ledger; Lago is for
  //    metering/analytics in Phase 1). Tune the amount to bill via Lago later.
  const plan = await post("/plans", {
    plan: {
      name: "Allowance Usage",
      code: PLAN_CODE,
      interval: "monthly",
      amount_cents: 0,
      amount_currency: "USD",
      pay_in_advance: false,
      charges: [
        {
          billable_metric_code: METRIC_CODE,
          charge_model: "standard",
          properties: { amount: "0" },
        },
      ],
    },
  });
  console.log(`plan(${PLAN_CODE}) → ${plan.status}`);

  console.log("Lago setup complete.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
