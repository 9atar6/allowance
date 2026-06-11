// =============================================================================
// Agent-readable spend state.
//
// Every successful proxied response carries x-allowance-* headers so an agent
// can watch its own budget shrink and adapt BEFORE hitting a 402 wall (switch
// to a cheaper model, finish the task, alert its operator). Values are edge
// snapshots taken just before the call: authoritative settlement happens
// asynchronously in Postgres, so treat them as accurate-but-approximate.
// =============================================================================

export interface SpendState {
  /** Account budget left in USD (snapshot, minus this call's estimate). */
  budgetRemaining: number;
  /** Free-plan requests left this month (only set on the free plan). */
  requestsRemaining?: number;
  /** USD left under the key's daily cap (only set if the cap exists). */
  dailyRemaining?: number;
  /** USD left under the key's monthly cap (only set if the cap exists). */
  monthlyRemaining?: number;
  /** USD left under the project's monthly budget (only set if it exists). */
  projectRemaining?: number;
}

const usd = (n: number): string => Math.max(0, n).toFixed(6);

export function spendHeaders(s: SpendState): Record<string, string> {
  const h: Record<string, string> = {
    "x-allowance-budget-remaining": usd(s.budgetRemaining),
  };
  if (s.requestsRemaining != null) {
    h["x-allowance-requests-remaining"] = String(
      Math.max(0, Math.floor(s.requestsRemaining)),
    );
  }
  if (s.dailyRemaining != null) {
    h["x-allowance-daily-remaining"] = usd(s.dailyRemaining);
  }
  if (s.monthlyRemaining != null) {
    h["x-allowance-monthly-remaining"] = usd(s.monthlyRemaining);
  }
  if (s.projectRemaining != null) {
    h["x-allowance-project-remaining"] = usd(s.projectRemaining);
  }
  return h;
}

/** Return a copy of the response with extra headers (keeps streaming body). */
export function withExtraHeaders(
  res: Response,
  headers: Record<string, string>,
): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}
