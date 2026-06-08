// =============================================================================
// x402 "Payment Required" responses.
//
// When the prepaid balance can't cover the call, we hard-stop with HTTP 402 and
// an x402-style JSON body describing how to settle (top up the wallet).
// =============================================================================

export interface X402Options {
  resource: string; // the proxied resource the client tried to reach
  balance: number;
  cost: number;
  topUpUrl: string;
}

export function buildX402Body(opts: X402Options): Record<string, unknown> {
  return {
    x402Version: 1,
    error: "PAYMENT_REQUIRED",
    message: "Allowance balance is insufficient for this request.",
    accepts: [
      {
        scheme: "prepaid",
        network: "allowance",
        resource: opts.resource,
        description: "Top up your prepaid Allowance balance to continue.",
        maxAmountRequired: opts.cost,
        balanceRemaining: opts.balance,
        payTo: opts.topUpUrl,
      },
    ],
  };
}
