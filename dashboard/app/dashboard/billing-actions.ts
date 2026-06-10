"use server";

import { getPolar, proProductId } from "@/lib/polar";
import { createClient } from "@/lib/supabase/server";

// ── Subscriptions (Pro plan) via Polar (merchant of record) ──────────────────

export interface SubResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Start a Polar checkout for the Pro subscription. The plan is NOT granted
 * here; only after Polar confirms via the webhook (→ set_plan). The Supabase
 * user id rides along as the external customer id so webhook events map back
 * to the right wallet.
 */
export async function startProCheckout(): Promise<SubResult> {
  const polar = getPolar();
  const productId = proProductId();
  if (!polar || !productId) {
    return { ok: false, error: "Billing is not configured yet." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const checkout = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: user.id,
      customerEmail: user.email,
      successUrl: `${origin}/dashboard?plan=upgraded`,
    });
    if (!checkout.url) return { ok: false, error: "Could not start checkout." };
    return { ok: true, url: checkout.url };
  } catch {
    return { ok: false, error: "Could not start checkout." };
  }
}

/**
 * Open the Polar customer portal so a Pro user can update their payment
 * method, view invoices, or cancel.
 */
export async function openBillingPortal(): Promise<SubResult> {
  const polar = getPolar();
  if (!polar) return { ok: false, error: "Billing is not configured yet." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  try {
    const session = await polar.customerSessions.create({
      externalCustomerId: user.id,
    });
    return { ok: true, url: session.customerPortalUrl };
  } catch {
    // Most likely: this user never purchased, so no Polar customer exists yet.
    return { ok: false, error: "No subscription to manage yet." };
  }
}
