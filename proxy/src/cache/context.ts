// =============================================================================
// KV edge cache for the proxy context.
//
// Stores metadata + balance snapshot + AES-GCM-encrypted credential. The TTL
// keeps balances reasonably fresh; the authoritative balance check still lives
// in the DB (debit_wallet's guarded UPDATE), so a slightly stale snapshot only
// risks one over-served call, never a negative balance.
// =============================================================================

import { DEFAULT_CTX_TTL, KV_CTX_PREFIX } from "../config";
import type { CachedProxyContext, Env } from "../types";

const keyFor = (hash: string) => `${KV_CTX_PREFIX}${hash}`;

function ttlSeconds(env: Env): number {
  const parsed = Number(env.KV_CONTEXT_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CTX_TTL;
}

export async function getCachedContext(
  env: Env,
  hash: string,
): Promise<CachedProxyContext | null> {
  return env.WALLET_KV.get<CachedProxyContext>(keyFor(hash), "json");
}

export async function putCachedContext(
  env: Env,
  hash: string,
  ctx: CachedProxyContext,
): Promise<void> {
  await env.WALLET_KV.put(keyFor(hash), JSON.stringify(ctx), {
    expirationTtl: ttlSeconds(env),
  });
}

/** Evict a cached context immediately (used for instant key revocation). */
export async function purgeCachedContext(env: Env, hash: string): Promise<void> {
  await env.WALLET_KV.delete(keyFor(hash));
}

/**
 * After a successful debit, write the decremented balance back to the cached
 * snapshot (preserving the already-encrypted credential) so the next request
 * sees fresh funds without a DB round-trip.
 */
export async function updateCachedBalance(
  env: Env,
  hash: string,
  newBalance: number,
): Promise<void> {
  const existing = await getCachedContext(env, hash);
  if (!existing) return; // nothing cached / expired — next miss will re-warm
  await putCachedContext(env, hash, { ...existing, balance: newBalance });
}
