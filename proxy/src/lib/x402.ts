// =============================================================================
// x402-style "Payment Required" responses.
//
// When the remaining budget can't cover the call, we hard-stop with HTTP 402
// and an x402-style JSON body so agents/clients can detect the cap
// machine-readably and point a human at the dashboard to raise it.
// =============================================================================

export interface X402Options {
  resource: string; // the proxied resource the client tried to reach
  balance: number; // budget remaining (USD)
  cost: number; // estimated cost of this call (USD)
  topUpUrl: string; // dashboard URL where the budget can be raised
}

export function buildX402Body(opts: X402Options): Record<string, unknown> {
  return {
    x402Version: 1,
    error: "PAYMENT_REQUIRED",
    message: "Allowance budget is exhausted for this key.",
    accepts: [
      {
        scheme: "budget",
        network: "allowance",
        resource: opts.resource,
        description: "Raise your Allowance budget to continue.",
        maxAmountRequired: opts.cost,
        budgetRemaining: opts.balance,
        payTo: opts.topUpUrl,
      },
    ],
  };
}
