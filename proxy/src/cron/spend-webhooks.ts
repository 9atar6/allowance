// =============================================================================
// Scheduled job: POST to a user's webhook when budget consumption crosses
// 50% / 80% / 100% of the baseline. Each threshold fires once per baseline
// (re-armed when the budget is set or auto-refilled). Cron-driven, so worst
// case a notification lags by one cron interval (15 min).
// =============================================================================

import { logEvent } from "../lib/log";
import {
  markSpendWebhookSent,
  walletsNeedingSpendWebhook,
  type SpendWebhookRow,
} from "../lib/supabase";
import type { Env } from "../types";

const WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * Defense in depth: the dashboard validates webhook URLs with a full SSRF
 * guard, but the RPC is reachable by any signed-in user directly. Re-check
 * here, at the point of use, before the worker POSTs anywhere.
 */
export function isSafeWebhookUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (h === "0.0.0.0" || h === "::1") return false;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (/^169\.254\./.test(h)) return false;
  if (h.includes(":") && /^(fc|fd|fe80)/.test(h)) return false;
  return true;
}

/** Payload sent to the user's URL. Pure + exported for tests. */
export function buildWebhookPayload(
  row: SpendWebhookRow,
  firedAtIso: string,
): Record<string, unknown> {
  return {
    type: "allowance.threshold_crossed",
    thresholds: row.thresholds, // e.g. [80] or [50, 80]
    budgetRemaining: row.balance,
    budgetBaseline: row.baseline,
    consumedPercent:
      row.baseline > 0
        ? Math.min(100, Math.round((1 - row.balance / row.baseline) * 100))
        : 100,
    firedAt: firedAtIso,
    manageUrl: "https://getallowance.dev/dashboard",
  };
}

export async function runSpendWebhooks(env: Env): Promise<void> {
  let rows: SpendWebhookRow[];
  try {
    rows = await walletsNeedingSpendWebhook(env);
  } catch {
    logEvent({ event: "spend_webhooks_query_failed" });
    return;
  }

  for (const row of rows) {
    if (!isSafeWebhookUrl(row.url)) {
      logEvent({ event: "spend_webhook_unsafe_url", userId: row.user_id });
      continue;
    }
    try {
      const res = await fetch(row.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildWebhookPayload(row, new Date().toISOString())),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      // Latch only on success; a failing receiver gets retried next cron tick.
      if (res.ok) {
        await markSpendWebhookSent(env, row.user_id, row.new_mask);
        logEvent({ event: "spend_webhook_sent", userId: row.user_id });
      } else {
        logEvent({
          event: "spend_webhook_rejected",
          userId: row.user_id,
          status: res.status,
        });
      }
    } catch {
      // Per-user failure must not abort the batch.
      logEvent({ event: "spend_webhook_failed", userId: row.user_id });
    }
  }
}
