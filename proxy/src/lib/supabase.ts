// =============================================================================
// Minimal Supabase RPC client (service_role) — no SDK, just fetch.
//
// Only the service_role-locked RPCs are reachable here:
//   - get_proxy_context(p_key_hash)
//   - debit_wallet(...)
// =============================================================================

import type { Env, RpcProxyContext } from "../types";

async function rpc<T>(
  env: Env,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    // Surface status only — response bodies may echo input; never log them.
    throw new Error(`rpc ${fn} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface LowBalanceWallet {
  user_id: string;
  email: string;
  balance: number;
  threshold: number;
}

/** Wallets below their alert threshold (and not alerted in the last 24h). */
export function walletsNeedingLowBalanceAlert(
  env: Env,
): Promise<LowBalanceWallet[]> {
  return rpc<LowBalanceWallet[]>(env, "wallets_needing_low_balance_alert", {});
}

/** Latch a wallet's low-balance alert so we don't email it again for 24h. */
export function markLowBalanceAlerted(
  env: Env,
  userId: string,
): Promise<unknown> {
  return rpc<unknown>(env, "mark_low_balance_alerted", { p_user_id: userId });
}

/** Resolve a proxy key hash to its full edge context (or null = unknown key). */
export function getProxyContext(
  env: Env,
  keyHash: string,
): Promise<RpcProxyContext | null> {
  return rpc<RpcProxyContext | null>(env, "get_proxy_context", {
    p_key_hash: keyHash,
  });
}

/**
 * Atomically debit the wallet and write the ledger + usage row.
 * Returns true if debited, false on insufficient funds / duplicate request_id.
 */
export function debitWallet(
  env: Env,
  params: {
    userId: string;
    endpointId: string | null;
    cost: number;
    requestId: string;
    statusCode?: number;
    chunkCount?: number;
    durationMs?: number;
    promptTokens?: number | null;
    completionTokens?: number | null;
  },
): Promise<boolean> {
  return rpc<boolean>(env, "debit_wallet", {
    p_user_id: params.userId,
    p_endpoint_id: params.endpointId,
    p_cost: params.cost,
    p_request_id: params.requestId,
    p_status_code: params.statusCode ?? null,
    p_chunk_count: params.chunkCount ?? null,
    p_duration_ms: params.durationMs ?? null,
    p_prompt_tokens: params.promptTokens ?? null,
    p_completion_tokens: params.completionTokens ?? null,
  });
}
