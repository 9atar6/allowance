// =============================================================================
// Cost computation.
//
//  - flat:       always cost_per_request.
//  - per_token:  prompt*inputCost + completion*outputCost, IF the upstream
//                reported usage. With no usage (provider didn't emit it), we
//                fall back to the flat fee so a call is never free by accident.
// =============================================================================

import type { ResolvedContext, TokenUsage } from "../types";

export function computeCost(
  ctx: ResolvedContext,
  usage: TokenUsage | null,
): number {
  if (ctx.meteringMode === "per_token" && usage) {
    return (
      usage.promptTokens * ctx.inputTokenCost +
      usage.completionTokens * ctx.outputTokenCost
    );
  }
  return ctx.costPerRequest; // flat, or per_token fallback
}
