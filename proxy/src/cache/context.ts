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
  const cached = await env.WALLET_KV.get<CachedProxyContext>(
    keyFor(hash),
    "json",
  );
  if (!cached) return null;
  // Hard-expire by ORIGINAL fetch time, not last write: settlement re-puts the
  // snapshot (fresh KV TTL) after every call, so steady traffic would
  // otherwise keep a stale balance alive forever and outrun budget changes.
  if (
    typeof cached.cached_at === "number" &&
    Date.now() - cached.cached_at > ttlSeconds(env) * 1000
  ) {
    return null;
  }
  return cached;
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
const DEFAULT_NEG_TTL_SECONDS = 60;
const negKey = (hash: string) => `neg:${hash}`;

function negTtlSeconds(env: Env): number {
  const parsed = Number(env.NEG_CACHE_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_NEG_TTL_SECONDS;
}

export async function isKeyNegativelyCached(
  env: Env,
  hash: string,
): Promise<boolean> {
  return (await env.WALLET_KV.get(negKey(hash))) !== null;
}

export async function cacheNegativeKey(env: Env, hash: string): Promise<void> {
  await env.WALLET_KV.put(negKey(hash), "1", {
    expirationTtl: negTtlSeconds(env),
  });
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

// ── Per-key monthly spend counter (for per-key monthly limits) ───────────────
const keyMonthKey = (hash: string, month: string) => `mspend:${hash}:${month}`;

/** USD spent by a key this month (best-effort edge counter; 0 if unset). */
export async function getKeyMonthlySpend(
  env: Env,
  hash: string,
  month: string,
): Promise<number> {
  const v = await env.WALLET_KV.get(keyMonthKey(hash, month));
  return v ? Number(v) : 0;
}

/** Add to this month's per-key spend (called during settlement). */
export async function addKeyMonthlySpend(
  env: Env,
  hash: string,
  month: string,
  amount: number,
): Promise<void> {
  const current = await getKeyMonthlySpend(env, hash, month);
  await env.WALLET_KV.put(keyMonthKey(hash, month), String(current + amount), {
    expirationTtl: MONTH_TTL_SECONDS,
  });
}

// ── Per-key lifetime spend counter (for child-key "pocket money" caps) ───────
// A child key's budget_limit is a one-time allowance, not monthly, so this
// counter never resets. TTL is long; a child key is short-lived by design.
const LIFETIME_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const totalSpendKey = (hash: string) => `tspend:${hash}`;

/** USD a key has spent over its lifetime (best-effort edge counter; 0 if unset). */
export async function getKeyTotalSpend(env: Env, hash: string): Promise<number> {
  const v = await env.WALLET_KV.get(totalSpendKey(hash));
  return v ? Number(v) : 0;
}

/** Add to a key's lifetime spend (called during settlement for child keys). */
export async function addKeyTotalSpend(
  env: Env,
  hash: string,
  amount: number,
): Promise<void> {
  const current = await getKeyTotalSpend(env, hash);
  await env.WALLET_KV.put(totalSpendKey(hash), String(current + amount), {
    expirationTtl: LIFETIME_TTL_SECONDS,
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
