// =============================================================================
// Edge rate limiting (Cloudflare Rate Limiting binding).
//
// Keyed per proxy-key hash so one tenant's burst can't starve others. Fails
// OPEN if the binding isn't configured — a missing limiter must never take the
// whole proxy down, and the WAF/zone-level rules are the backstop.
// =============================================================================

import type { Env } from "../types";

export async function withinRateLimit(env: Env, key: string): Promise<boolean> {
  if (!env.RATE_LIMITER) return true;
  const { success } = await env.RATE_LIMITER.limit({ key });
  return success;
}

/**
 * Pre-auth limiter keyed by client IP. Runs BEFORE key resolution so a flood of
 * bad/random keys can't reach the DB. Fails OPEN if the binding is unset.
 */
export async function withinIpRateLimit(env: Env, ip: string): Promise<boolean> {
  if (!env.RATE_LIMITER_IP) return true;
  const { success } = await env.RATE_LIMITER_IP.limit({ key: ip });
  return success;
}
