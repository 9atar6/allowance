// =============================================================================
// Scheduled job: auto-reload a prepaid balance by charging the user's saved card
// off-session when it drops below their threshold.
//
// Safety:
//   - We latch (mark_auto_reload_attempted) BEFORE charging, so a partial
//     failure never recharges within the hour.
//   - credit_wallet is idempotent on (type, external_ref = PaymentIntent id).
//   - No-ops if STRIPE_SECRET_KEY is unset.
// =============================================================================

import { logEvent } from "../lib/log";
import {
  creditWallet,
  markAutoReloadAttempted,
  walletsNeedingAutoReload,
  type AutoReloadWallet,
} from "../lib/supabase";
import type { Env } from "../types";

/** Create + confirm an off-session PaymentIntent. Returns its id if it succeeded. */
async function chargeOffSession(
  env: Env,
  w: AutoReloadWallet,
): Promise<string | null> {
  const form = new URLSearchParams({
    amount: String(Math.round(w.amount * 100)), // USD → cents
    currency: "usd",
    customer: w.customer_id,
    payment_method: w.payment_method_id,
    off_session: "true",
    confirm: "true",
    "metadata[user_id]": w.user_id,
    "metadata[kind]": "auto_reload",
  });

  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
    body: form,
  });
  if (!res.ok) return null; // declined / requires action / error
  const pi = (await res.json()) as { id?: string; status?: string };
  return pi.status === "succeeded" && pi.id ? pi.id : null;
}

export async function runAutoReloads(env: Env): Promise<void> {
  if (!env.STRIPE_SECRET_KEY) {
    logEvent({ event: "auto_reload_skipped", reason: "stripe_unconfigured" });
    return;
  }

  let wallets: AutoReloadWallet[];
  try {
    wallets = await walletsNeedingAutoReload(env);
  } catch {
    logEvent({ event: "auto_reload_query_failed" });
    return;
  }

  for (const w of wallets) {
    try {
      // Latch first — never risk a double charge if a later step throws.
      await markAutoReloadAttempted(env, w.user_id);
      const pi = await chargeOffSession(env, w);
      if (!pi) {
        logEvent({ event: "auto_reload_charge_failed", userId: w.user_id });
        continue; // low-balance email still nudges them to top up manually
      }
      await creditWallet(env, {
        userId: w.user_id,
        amount: w.amount,
        type: "topup",
        externalRef: pi, // idempotency key
      });
      logEvent({ event: "auto_reload_succeeded", userId: w.user_id });
    } catch {
      logEvent({ event: "auto_reload_error", userId: w.user_id });
    }
  }
}
