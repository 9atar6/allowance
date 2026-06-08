import "server-only";

// Lago provisioning. The proxy emits usage events keyed on
// external_subscription_id = user_id; those events only land if a Lago customer
// + subscription with that external id already exist. We provision them the
// first time a user tops up (the earliest point they can generate usage, since
// the proxy 402s at zero balance). All calls are idempotent and best-effort —
// Lago must never block the payment flow.

interface LagoConfig {
  url: string;
  key: string;
  planCode: string;
}

function config(): LagoConfig | null {
  const url = process.env.LAGO_API_URL;
  const key = process.env.LAGO_API_KEY;
  const planCode = process.env.LAGO_PLAN_CODE;
  if (!url || !key || !planCode) return null; // Lago not configured → skip
  return { url, key, planCode };
}

async function lagoPost(
  cfg: LagoConfig,
  path: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${cfg.url}/api/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify(body),
  });
}

/** Upsert a Lago customer (Lago treats external_id as the upsert key). */
async function ensureCustomer(cfg: LagoConfig, userId: string, email: string) {
  await lagoPost(cfg, "/customers", {
    customer: { external_id: userId, email },
  });
}

/**
 * Create the usage subscription. external_id = user_id so the proxy's events
 * (external_subscription_id = user_id) attach to it. A 4xx here usually means
 * "already subscribed" — which is exactly the idempotent outcome we want.
 */
async function ensureSubscription(cfg: LagoConfig, userId: string) {
  await lagoPost(cfg, "/subscriptions", {
    subscription: {
      external_customer_id: userId,
      external_id: userId,
      plan_code: cfg.planCode,
    },
  });
}

/** Idempotent, best-effort: ensure the user has a Lago customer + subscription. */
export async function ensureLagoProvisioned(
  userId: string,
  email: string,
): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  try {
    await ensureCustomer(cfg, userId, email);
    await ensureSubscription(cfg, userId);
  } catch {
    // Never let metering setup break billing. The proxy's events are also
    // best-effort, and a later top-up will retry provisioning.
  }
}
