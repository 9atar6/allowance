// =============================================================================
// Fire-and-forget error alerting to an optional incoming webhook.
//
// Sends both `text` (Slack) and `content` (Discord) so either platform works.
// No-op if ALERT_WEBHOOK_URL is unset, and never throws — alerting must never
// take down the request path.
// =============================================================================

import type { Env } from "../types";

export async function sendAlert(env: Env, message: string): Promise<void> {
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
