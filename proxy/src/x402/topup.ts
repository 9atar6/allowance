// =============================================================================
// POST /v1/topup/:amount — fund a prepaid balance with USDC via x402.
//
// Flow:
//   - no X-PAYMENT      → 402 with payment requirements (the x402 challenge)
//   - X-PAYMENT present → verify → settle (moves funds) → credit_wallet
//
// We credit ONLY after on-chain settlement succeeds, using the tx hash as the
// idempotency key, so a retried request can never double-credit.
// =============================================================================

import type { Context } from "hono";
import { logEvent } from "../lib/log";
import { creditWallet } from "../lib/supabase";
import type { Env, Variables } from "../types";
import { decodeXPayment, encodeXPaymentResponse } from "./codec";
import { settlePayment, verifyPayment } from "./facilitator";
import { buildRequirements, isValidTier, TOPUP_TIERS, x402Configured } from "./requirements";
import type { X402PaymentRequirements } from "./types";

function challenge(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  requirements: X402PaymentRequirements,
  error: string,
): Response {
  // The x402 402 body: version + the list of acceptable payment requirements.
  return c.json({ x402Version: 1, accepts: [requirements], error }, 402);
}

export async function handleTopup(
  c: Context<{ Bindings: Env; Variables: Variables }>,
): Promise<Response> {
  const env = c.env;
  if (!x402Configured(env)) {
    return c.json({ error: "x402_not_configured" }, 503);
  }

  const amount = Number(c.req.param("amount"));
  if (!isValidTier(amount)) {
    return c.json({ error: "invalid_amount", allowed: TOPUP_TIERS }, 400);
  }

  const { userId } = c.get("resolved"); // set by authMiddleware (valid key required)
  const requestId = c.get("requestId");
  const requirements = buildRequirements(env, amount, new URL(c.req.url).toString());

  // ── x402 challenge ────────────────────────────────────────────────────────
  const xPayment = c.req.header("X-PAYMENT");
  if (!xPayment) {
    return challenge(c, requirements, "X-PAYMENT header is required");
  }
  const payload = decodeXPayment(xPayment);
  if (!payload) {
    return challenge(c, requirements, "malformed X-PAYMENT header");
  }

  try {
    // Verify the signed payment is valid for these requirements.
    const verification = await verifyPayment(env, payload, requirements);
    if (!verification.isValid) {
      return challenge(c, requirements, verification.invalidReason ?? "payment invalid");
    }

    // Settle on-chain. Funds move here — credit only on success.
    const settlement = await settlePayment(env, payload, requirements);
    if (!settlement.success || !settlement.transaction) {
      return challenge(c, requirements, settlement.errorReason ?? "settlement failed");
    }

    // Credit the prepaid balance. Idempotent on the tx hash.
    const credited = await creditWallet(env, {
      userId,
      amount,
      type: "topup",
      externalRef: settlement.transaction,
    });

    logEvent({ event: "x402_topup", requestId, userId, amount, settled: true });
    c.header("X-PAYMENT-RESPONSE", encodeXPaymentResponse(settlement));
    return c.json({ credited: amount, transaction: settlement.transaction, ok: credited });
  } catch {
    logEvent({ event: "x402_topup_error", requestId, userId });
    return c.json({ error: "x402_settlement_error" }, 502);
  }
}
