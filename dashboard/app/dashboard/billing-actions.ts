"use server";

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { topUpSchema } from "@/lib/validation";

export interface TopUpResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Create a Stripe Checkout session for a prepaid balance top-up.
 * The wallet is NOT credited here — only after Stripe confirms payment via the
 * webhook (→ credit_wallet). user_id rides along in metadata for the webhook.
 */
export async function createTopUp(formData: FormData): Promise<TopUpResult> {
  const parsed = topUpSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) {
    return { ok: false, error: "Enter an amount between $5 and $10,000." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(parsed.data.amount * 100), // cents
            product_data: { name: "Allowance balance top-up" },
          },
        },
      ],
      // Surface user_id on both the session and the payment intent so the
      // webhook can credit the right wallet idempotently.
      metadata: { user_id: user.id },
      payment_intent_data: { metadata: { user_id: user.id } },
      success_url: `${origin}/dashboard?topup=success`,
      cancel_url: `${origin}/dashboard?topup=cancelled`,
    });

    if (!session.url) return { ok: false, error: "Could not start checkout." };
    return { ok: true, url: session.url };
  } catch {
    return { ok: false, error: "Could not start checkout." };
  }
}

// ── Subscriptions (Pro plan) ─────────────────────────────────────────────────

export interface SubResult {
  ok: boolean;
  url?: string;
  error?: string;
}

const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;

/**
 * Start a Stripe Checkout in subscription mode for the Pro plan. The plan is NOT
 * granted here — only after Stripe confirms via the webhook (→ set_plan).
 * user_id rides on both the session and the subscription so the webhook can map
 * later subscription.* events back to the wallet.
 */
export async function startProCheckout(): Promise<SubResult> {
  if (!PRO_PRICE_ID) return { ok: false, error: "Billing is not configured yet." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${origin}/dashboard?plan=upgraded`,
      cancel_url: `${origin}/dashboard?plan=cancelled`,
    });
    if (!session.url) return { ok: false, error: "Could not start checkout." };
    return { ok: true, url: session.url };
  } catch {
    return { ok: false, error: "Could not start checkout." };
  }
}

/**
 * Open the Stripe Billing Portal so a Pro user can update their card, view
 * invoices, or cancel. Requires a stored Stripe customer id (set by the webhook).
 */
export async function openBillingPortal(): Promise<SubResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: wallet } = await supabase
    .from("wallets")
    .select("stripe_customer_id")
    .single();
  const customerId = wallet?.stripe_customer_id as string | undefined;
  if (!customerId) return { ok: false, error: "No subscription to manage yet." };

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });
    return { ok: true, url: portal.url };
  } catch {
    return { ok: false, error: "Could not open the billing portal." };
  }
}
