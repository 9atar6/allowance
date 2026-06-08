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
