// =============================================================================
// Asynchronous settlement — runs inside ctx.waitUntil() after the response
// (or stream) is delivered, so it never adds latency to the proxied call.
//
// Flow:
//   1. Atomic debit in Postgres (authoritative, idempotent on requestId).
//   2. Refresh the KV balance snapshot.
//   3. Bump only the edge counters that are actually enforced for this request
//      (skipping unused writes keeps per-request KV cost low).
// =============================================================================

import {
  addDailySpend,
  addKeyMonthlySpend,
  addKeyTotalSpend,
  addProjectSpend,
  incrMonthlyCount,
  updateCachedBalance,
  utcDateKey,
  utcMonthKey,
} from "../cache/context";
import { logEvent } from "../lib/log";
import { debitWallet } from "../lib/supabase";
import type { ActiveRequest, Env, PlanTier, TokenUsage } from "../types";

export async function settle(
  env: Env,
  ctx: ActiveRequest,
  params: {
    requestId: string;
    statusCode: number;
    chunkCount: number;
    durationMs: number;
    cost: number; // computed (flat or per-token) by the handler
    usage: TokenUsage | null;
    // Which edge counters this request actually needs, so we skip unused writes.
    dailyLimit: number | null;
    monthlyLimit: number | null;
    budgetLimit: number | null;
    plan: PlanTier;
    monthlyBudget: number | null;
  },
): Promise<void> {
  try {
    const debited = await debitWallet(env, {
      userId: ctx.userId,
      endpointId: ctx.endpointId,
      cost: params.cost,
      requestId: params.requestId,
      statusCode: params.statusCode,
      chunkCount: params.chunkCount,
      durationMs: params.durationMs,
      promptTokens: params.usage?.promptTokens ?? null,
      completionTokens: params.usage?.completionTokens ?? null,
    });

    if (!debited) {
      // Insufficient funds at settle time (edge snapshot was stale) or a
      // duplicate request_id. Either way the DB is the source of truth.
      logEvent({
        event: "settlement_not_debited",
        requestId: params.requestId,
        userId: ctx.userId,
        reason: "insufficient_or_duplicate",
      });
      return;
    }

    // Always: keep the edge balance snapshot fresh so the next call sees it.
    await updateCachedBalance(env, ctx.keyHash, ctx.balance - params.cost);

    // Conditional: only write the counters this request's limits actually use.
    if (params.dailyLimit != null) {
      await addDailySpend(env, ctx.keyHash, utcDateKey(), params.cost);
    }
    if (params.monthlyLimit != null) {
      await addKeyMonthlySpend(env, ctx.keyHash, utcMonthKey(), params.cost);
    }
    if (params.budgetLimit != null) {
      await addKeyTotalSpend(env, ctx.keyHash, params.cost);
    }
    if (params.plan === "free") {
      await incrMonthlyCount(env, ctx.userId, utcMonthKey());
    }
    if (ctx.projectId && params.monthlyBudget != null) {
      await addProjectSpend(env, ctx.projectId, utcMonthKey(), params.cost);
    }

    logEvent({
      event: "settled",
      requestId: params.requestId,
      userId: ctx.userId,
      endpointId: ctx.endpointId,
      status: params.statusCode,
      chunks: params.chunkCount,
      durationMs: params.durationMs,
    });
  } catch {
    // Never let settlement throw — the client already has their response.
    logEvent({ event: "settlement_error", requestId: params.requestId, userId: ctx.userId });
  }
}
