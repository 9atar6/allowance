// =============================================================================
// Scheduled job: email users whose prepaid balance dropped below their alert
// threshold. Runs off the request path (cron), so it never adds latency.
//
// No-ops gracefully if RESEND_API_KEY / RESEND_FROM are unset.
// =============================================================================

import { logEvent } from "../lib/log";
import {
  markLowBalanceAlerted,
  walletsNeedingLowBalanceAlert,
  type LowBalanceWallet,
} from "../lib/supabase";
import type { Env } from "../types";

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

async function sendAlertEmail(env: Env, w: LowBalanceWallet): Promise<void> {
  const appUrl = env.APP_URL ?? "https://getallowance.dev";
  const body = {
    from: env.RESEND_FROM,
    to: [w.email],
    subject: "Your Allowance budget is running low",
    html: `
      <div style="font-family:ui-sans-serif,system-ui,sans-serif;color:#1a1a1a">
        <h2 style="margin:0 0 12px">Budget running low</h2>
        <p>Your Allowance budget has <strong>${usd(w.balance)}</strong> left, below
        your alert threshold of ${usd(w.threshold)}.</p>
        <p>When it reaches zero, your API calls stop with HTTP 402. Raise your
        budget to keep everything running.</p>
        <p><a href="${appUrl}/dashboard"
          style="display:inline-block;background:#5b5ef0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
          Open your dashboard</a></p>
      </div>`,
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

export async function runLowBalanceAlerts(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    logEvent({ event: "low_balance_alerts_skipped", reason: "email_unconfigured" });
    return;
  }

  let wallets: LowBalanceWallet[];
  try {
    wallets = await walletsNeedingLowBalanceAlert(env);
  } catch {
    logEvent({ event: "low_balance_alerts_query_failed" });
    return;
  }

  for (const w of wallets) {
    try {
      await sendAlertEmail(env, w);
      await markLowBalanceAlerted(env, w.user_id);
      logEvent({ event: "low_balance_alerted", userId: w.user_id });
    } catch {
      // Per-wallet failure must not abort the rest of the batch.
      logEvent({ event: "low_balance_alert_failed", userId: w.user_id });
    }
  }
}
