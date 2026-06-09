// =============================================================================
// KV edge cache for the proxy context.
//
// Stores metadata + balance snapshot + AES-GCM-encrypted credential. The TTL
// keeps balances reasonably fresh; the authoritative balance check still lives
// in the DB (debit_wallet's guarded UPDATE), so a slightly stale snapshot only
// risks one over-served call, never a negative balance.
// =============================================================================

import { DEFAULT_CTX_TTL, KV_CTX_PREFIX, KV_MONTH_PREFIX } from "../config";
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

// ── Negative cache: short-lived marker for keys the DB said are invalid, so a
// flood of bad/revoked keys can't hammer the database (cost + DoS protection). ─
const NEG_TTL_SECONDS = 60;
const negKey = (hash: string) => `neg:${hash}`;

export async function isKeyNegativelyCached(
  env: Env,
  hash: string,
): Promise<boolean> {
  return (await env.WALLET_KV.get(negKey(hash))) !== null;
}

export async function cacheNegativeKey(env: Env, hash: string): Promise<void> {
  await env.WALLET_KV.put(negKey(hash), "1", { expirationTtl: NEG_TTL_SECONDS });
}

// ── Per-key daily spend counter (for per-key daily limits) ───────────────────
const SPEND_TTL_SECONDS = 60 * 60 * 48; // 2 days, so yesterday's key expires

/** UTC day key, e.g. "2026-06-08". */
export function utcDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const spendKey = (hash: string, date: string) => `spend:${hash}:${date}`;

/** Spend so far today for a key (best-effort edge counter; 0 if unset). */
export async function getDailySpend(
  env: Env,
  hash: string,
  date: string,
): Promise<number> {
  const v = await env.WALLET_KV.get(spendKey(hash, date));
  return v ? Number(v) : 0;
}

/** Add to today's spend counter for a key (called during settlement). */
export async function addDailySpend(
  env: Env,
  hash: string,
  date: string,
  amount: number,
): Promise<void> {
  const current = await getDailySpend(env, hash, date);
  await env.WALLET_KV.put(spendKey(hash, date), String(current + amount), {
    expirationTtl: SPEND_TTL_SECONDS,
  });
}

// ── Per-user monthly request counter (for the free-plan hard cap) ────────────
const MONTH_TTL_SECONDS = 60 * 60 * 24 * 35; // ~35 days, so last month expires

/** UTC month key, e.g. "2026-06". */
export function utcMonthKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

const monthKey = (userId: string, month: string) =>
  `${KV_MONTH_PREFIX}${userId}:${month}`;

/** Requests counted this month for a user (best-effort edge counter; 0 if unset). */
export async function getMonthlyCount(
  env: Env,
  userId: string,
  month: string,
): Promise<number> {
  const v = await env.WALLET_KV.get(monthKey(userId, month));
  return v ? Number(v) : 0;
}

/** Increment this month's request counter for a user (called during settlement). */
export async function incrMonthlyCount(
  env: Env,
  userId: string,
  month: string,
): Promise<void> {
  const current = await getMonthlyCount(env, userId, month);
  await env.WALLET_KV.put(monthKey(userId, month), String(current + 1), {
    expirationTtl: MONTH_TTL_SECONDS,
  });
}

// ── Per-project monthly spend counter (for the project-wide USD budget) ──────
const projSpendKey = (projectId: string, month: string) =>
  `pspend:${projectId}:${month}`;

/** USD spent by a project this month (best-effort edge counter; 0 if unset). */
export async function getProjectSpend(
  env: Env,
  projectId: string,
  month: string,
): Promise<number> {
  const v = await env.WALLET_KV.get(projSpendKey(projectId, month));
  return v ? Number(v) : 0;
}

/** Add to this month's project spend (called during settlement). */
export async function addProjectSpend(
  env: Env,
  projectId: string,
  month: string,
  amount: number,
): Promise<void> {
  const current = await getProjectSpend(env, projectId, month);
  await env.WALLET_KV.put(projSpendKey(projectId, month), String(current + amount), {
    expirationTtl: MONTH_TTL_SECONDS,
  });
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
