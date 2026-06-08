// =============================================================================
// Cost computation.
//
//  - flat:       always cost_per_request.
//  - per_token:  prompt*inputCost + completion*outputCost, IF the upstream
//                reported usage. With no usage (provider didn't emit it), we
//                fall back to the flat fee so a call is never free by accident.
// =============================================================================

import type { ActiveRequest, TokenUsage } from "../types";

export function computeCost(
  active: ActiveRequest,
  usage: TokenUsage | null,
): number {
  if (active.meteringMode === "per_token" && usage) {
    return (
      usage.promptTokens * active.inputTokenCost +
      usage.completionTokens * active.outputTokenCost
    );
  }
  return active.costPerRequest; // flat, or per_token fallback
}
