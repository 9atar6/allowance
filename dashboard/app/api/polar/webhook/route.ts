// Polar webhook — mirrors the Pro subscription state onto the wallet (plan).
// Verifies the Standard-Webhooks signature against the raw body, then calls
// set_plan (service_role). The external customer id IS the Supabase user id
// (set at checkout), so events map straight back to the wallet.
import { type NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.past_due",
  "subscription.revoked",
]);

export async function POST(req: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // Raw body is required for signature verification — do not parse as JSON.
  const rawBody = await req.text();

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(
      rawBody,
      Object.fromEntries(req.headers.entries()),
      secret,
    );
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const sub = event.data as {
      id: string;
      status: string;
      currentPeriodEnd?: Date | null;
      customer?: { id?: string; externalId?: string | null };
    };
    const userId = sub.customer?.externalId;

    if (userId) {
      // active/trialing → Pro. canceled = scheduled, still paid until period
      // end (status stays "active" until then). revoked/past_due/etc → Free.
      const isActive = sub.status === "active" || sub.status === "trialing";
      const plan = isActive ? "pro" : "free";
      const periodEnd = sub.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd).toISOString()
        : null;

      const admin = createAdminClient();
      const { error } = await admin.rpc("set_plan", {
        p_user_id: userId,
        p_plan: plan,
        p_status: sub.status,
        p_customer_id: sub.customer?.id ?? null,
        p_subscription_id: sub.id,
        p_period_end: periodEnd,
      });
      if (error) {
        // Non-2xx → Polar retries until the plan state converges.
        return NextResponse.json({ error: "plan_update_failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
