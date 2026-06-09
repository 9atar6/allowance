// Stripe webhook — mirrors the Pro subscription state onto the wallet (plan).
// Verifies the signature against the raw body, then calls set_plan (service_role).
import type Stripe from "stripe";
import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Node runtime: we need the raw body + Stripe's crypto for signature checks.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // Raw body is required for signature verification — do not parse as JSON.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch {
    // Bad signature → reject. Never trust an unverified payload.
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // ── Subscription lifecycle → mirror the plan onto the wallet ───────────────
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.user_id;

    if (userId) {
      // active/trialing → Pro; anything else (canceled, unpaid, past_due) → Free.
      const isActive = sub.status === "active" || sub.status === "trialing";
      const plan = isActive ? "pro" : "free";
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      // current_period_end has shifted location across Stripe API versions;
      // read it defensively so we don't couple to a pinned type.
      const periodEndUnix = (sub as unknown as { current_period_end?: number })
        .current_period_end;
      const periodEnd =
        typeof periodEndUnix === "number"
          ? new Date(periodEndUnix * 1000).toISOString()
          : null;

      const admin = createAdminClient();
      const { error } = await admin.rpc("set_plan", {
        p_user_id: userId,
        p_plan: plan,
        p_status: sub.status,
        p_customer_id: customerId,
        p_subscription_id: sub.id,
        p_period_end: periodEnd,
      });
      if (error) {
        // Retry so the plan state converges with Stripe.
        return NextResponse.json({ error: "plan_update_failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
