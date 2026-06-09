// =============================================================================
// Asynchronous settlement — runs inside ctx.waitUntil() after the response
// (or stream) is delivered, so it never adds latency to the proxied call.
//
// Flow:
//   1. Atomic debit in Postgres (authoritative, idempotent on requestId).
//   2. Refresh the KV balance snapshot.
//   3. Emit the Lago usage event.
// =============================================================================

import {
  addDailySpend,
  incrMonthlyCount,
  updateCachedBalance,
  utcDateKey,
  utcMonthKey,
} from "../cache/context";
import { logEvent } from "../lib/log";
import { debitWallet } from "../lib/supabase";
import type { ActiveRequest, Env, TokenUsage } from "../types";
import { sendLagoEvent } from "./lago";

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

    // Keep the edge snapshot in sync so the next call sees the new balance.
    await updateCachedBalance(env, ctx.keyHash, ctx.balance - params.cost);
    // Bump the per-key daily spend counter (for per-key daily limits).
    await addDailySpend(env, ctx.keyHash, utcDateKey(), params.cost);
    // Bump the per-user monthly request counter (for the free-plan cap).
    await incrMonthlyCount(env, ctx.userId, utcMonthKey());

    await sendLagoEvent(env, {
      userId: ctx.userId,
      requestId: params.requestId,
      cost: params.cost,
      chunkCount: params.chunkCount,
      statusCode: params.statusCode,
    });

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
