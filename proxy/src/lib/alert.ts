// =============================================================================
// Fire-and-forget error alerting to an optional incoming webhook.
//
// Sends both `text` (Slack) and `content` (Discord) so either platform works.
// No-op if ALERT_WEBHOOK_URL is unset, and never throws — alerting must never
// take down the request path.
// =============================================================================

import type { Env } from "../types";

async function sendAlert(env: Env, message: string): Promise<void> {
  if (!env.ALERT_WEBHOOK_URL) return;
  try {
    await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, content: message }),
    });
  } catch {
    /* swallow — alerting is best-effort */
  }
}

// ── Error-rate window ─────────────────────────────────────────────────────────
// Count unhandled errors per 5-minute window in KV and alert ONCE when the
// window crosses the threshold — a burst pages you once, not 500 times.

const ERROR_WINDOW_SECONDS = 5 * 60;
const ERROR_ALERT_THRESHOLD = 5;

function windowKey(now: Date = new Date()): string {
  const bucket = Math.floor(now.getTime() / (ERROR_WINDOW_SECONDS * 1000));
  return `errwin:${bucket}`;
}

/** Record one unhandled error; alert exactly when the window hits the threshold. */
export async function recordErrorAndMaybeAlert(
  env: Env,
  detail: string,
): Promise<void> {
  try {
    const key = windowKey();
    const current = Number((await env.WALLET_KV.get(key)) ?? 0) + 1;
    await env.WALLET_KV.put(key, String(current), {
      expirationTtl: ERROR_WINDOW_SECONDS * 2,
    });
    if (current === ERROR_ALERT_THRESHOLD) {
      await sendAlert(
        env,
        `Allowance worker: ${current} unhandled errors in the last 5 minutes. Latest: ${detail}`,
      );
    }
  } catch {
    /* never let alerting break anything */
  }
}
