// =============================================================================
// Lago usage metering — best-effort, off the hot path (called from waitUntil).
//
// transaction_id = our request_id → Lago dedupes retries idempotently.
// Failures here must NOT affect the user's response or the authoritative debit;
// we log status only and move on.
// =============================================================================

import { logEvent } from "../lib/log";
import type { Env } from "../types";

export async function sendLagoEvent(
  env: Env,
  params: {
    userId: string;
    requestId: string;
    cost: number;
    chunkCount?: number;
    statusCode?: number;
  },
): Promise<void> {
  // Skip cleanly if Lago isn't configured in this environment.
  if (!env.LAGO_API_KEY || !env.LAGO_API_URL) return;

  try {
    const res = await fetch(`${env.LAGO_API_URL}/api/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LAGO_API_KEY}`,
      },
      body: JSON.stringify({
        event: {
          transaction_id: params.requestId,
          external_subscription_id: params.userId,
          code: env.LAGO_EVENT_CODE,
          properties: {
            cost: params.cost,
            chunks: params.chunkCount ?? 0,
            status: params.statusCode ?? 0,
          },
        },
      }),
    });
    if (!res.ok) {
      logEvent({ event: "lago_event_failed", requestId: params.requestId, status: res.status });
    }
  } catch {
    // Network blip — telemetry only; never throw into settlement.
    logEvent({ event: "lago_event_error", requestId: params.requestId });
  }
}
