// =============================================================================
// Auth middleware — resolves the Bearer proxy key into an in-memory context.
//
// A key is either single-endpoint (legacy) or project-bound (a set of routes).
// Cache-miss: get_proxy_context RPC -> encrypt each credential -> cache.
// Cache-hit:  read KV -> decrypt creds in memory.
//
// It only resolves the KEY context; the request handler then picks the active
// endpoint (by slug) and enforces balance/limits.
// =============================================================================

import { createMiddleware } from "hono/factory";
import {
  cacheNegativeKey,
  getCachedContext,
  isKeyNegativelyCached,
  putCachedContext,
} from "../cache/context";
import { decryptEdge, encryptEdge } from "../lib/edge-crypto";
import { sha256Hex } from "../lib/hash";
import { logEvent } from "../lib/log";
import { withinIpRateLimit } from "../lib/rate-limit";
import { getProxyContext } from "../lib/supabase";
import type {
  CachedProxyContext,
  CachedRoute,
  Env,
  ResolvedContext,
  ResolvedEndpoint,
  RpcProxyContext,
  RpcRoute,
  Variables,
} from "../types";

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** Safe JSON.parse of the decrypted header map; {} on anything malformed. */
function parseHeaderMap(json: string | null): Record<string, string> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

// ── RPC route -> cached route (encrypt credential before it touches KV) ───────
async function encryptRoute(env: Env, r: RpcRoute): Promise<CachedRoute> {
  return {
    slug: r.slug,
    endpoint_id: r.endpoint_id,
    target_url: r.target_url,
    cost_per_request: r.cost_per_request,
    metering_mode: r.metering_mode,
    input_token_cost: r.input_token_cost,
    output_token_cost: r.output_token_cost,
    upstream_header_enc: r.upstream_header
      ? await encryptEdge(env.EDGE_ENCRYPTION_KEY, r.upstream_header)
      : null,
  };
}

async function rpcToCached(env: Env, ctx: RpcProxyContext): Promise<CachedProxyContext> {
  const common = { user_id: ctx.user_id, balance: ctx.balance, plan: ctx.plan ?? "free", daily_limit: ctx.daily_limit, project_id: ctx.project_id ?? null, monthly_budget: ctx.monthly_budget ?? null, cached_at: Date.now() };
  if (ctx.routes) {
    const routes = await Promise.all(ctx.routes.map((r) => encryptRoute(env, r)));
    return { ...common, single: null, routes };
  }
  const encrypted = ctx.upstream_header
    ? await encryptEdge(env.EDGE_ENCRYPTION_KEY, ctx.upstream_header)
    : null;
  return {
    ...common,
    single: {
      slug: null,
      endpoint_id: ctx.endpoint_id ?? "",
      target_url: ctx.target_url ?? "",
      cost_per_request: ctx.cost_per_request ?? 0,
      metering_mode: ctx.metering_mode ?? "flat",
      input_token_cost: ctx.input_token_cost ?? 0,
      output_token_cost: ctx.output_token_cost ?? 0,
      endpoint_active: ctx.endpoint_active ?? false,
      upstream_header_enc: encrypted,
    },
    routes: null,
  };
}

// ── RPC -> resolved (in-memory, plaintext creds) ─────────────────────────────
function rpcRouteToEndpoint(r: RpcRoute): ResolvedEndpoint {
  return {
    slug: r.slug,
    endpointId: r.endpoint_id,
    targetUrl: r.target_url,
    costPerRequest: r.cost_per_request,
    meteringMode: r.metering_mode,
    inputTokenCost: r.input_token_cost,
    outputTokenCost: r.output_token_cost,
    upstreamHeaders: parseHeaderMap(r.upstream_header),
  };
}

function rpcToResolved(ctx: RpcProxyContext, keyHash: string): ResolvedContext {
  const common = { userId: ctx.user_id, balance: ctx.balance, plan: ctx.plan ?? "free", dailyLimit: ctx.daily_limit, projectId: ctx.project_id ?? null, monthlyBudget: ctx.monthly_budget ?? null, keyHash };
  if (ctx.routes) {
    return { ...common, single: null, routes: ctx.routes.map(rpcRouteToEndpoint) };
  }
  return {
    ...common,
    single: {
      slug: null,
      endpointId: ctx.endpoint_id ?? "",
      targetUrl: ctx.target_url ?? "",
      costPerRequest: ctx.cost_per_request ?? 0,
      meteringMode: ctx.metering_mode ?? "flat",
      inputTokenCost: ctx.input_token_cost ?? 0,
      outputTokenCost: ctx.output_token_cost ?? 0,
      upstreamHeaders: parseHeaderMap(ctx.upstream_header ?? null),
      endpointActive: ctx.endpoint_active ?? false,
    },
    routes: null,
  };
}

// ── Cached -> resolved (decrypt creds) ───────────────────────────────────────
async function decryptRoute(env: Env, r: CachedRoute): Promise<ResolvedEndpoint> {
  const json = r.upstream_header_enc
    ? await decryptEdge(env.EDGE_ENCRYPTION_KEY, r.upstream_header_enc)
    : null;
  return {
    slug: r.slug,
    endpointId: r.endpoint_id,
    targetUrl: r.target_url,
    costPerRequest: r.cost_per_request,
    meteringMode: r.metering_mode,
    inputTokenCost: r.input_token_cost,
    outputTokenCost: r.output_token_cost,
    upstreamHeaders: parseHeaderMap(json),
  };
}

async function cachedToResolved(
  env: Env,
  cached: CachedProxyContext,
  keyHash: string,
): Promise<ResolvedContext> {
  const common = { userId: cached.user_id, balance: cached.balance, plan: cached.plan ?? "free", dailyLimit: cached.daily_limit, projectId: cached.project_id ?? null, monthlyBudget: cached.monthly_budget ?? null, keyHash };
  if (cached.routes) {
    const routes = await Promise.all(cached.routes.map((r) => decryptRoute(env, r)));
    return { ...common, single: null, routes };
  }
  const s = cached.single!;
  const ep = await decryptRoute(env, s);
  return { ...common, single: { ...ep, endpointActive: s.endpoint_active }, routes: null };
}

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  // Pre-auth IP throttle: stops raw floods before any key resolution / DB work.
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!(await withinIpRateLimit(c.env, ip))) {
    return c.json({ error: "rate_limited" }, 429);
  }

  const key = extractBearer(c.req.header("Authorization"));
  if (!key) {
    return c.json({ error: "missing_api_key" }, 401);
  }

  const keyHash = await sha256Hex(key);
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);

  let resolved: ResolvedContext | null = null;

  // ── Cache hit ─────────────────────────────────────────────────────────────
  const cached = await getCachedContext(c.env, keyHash);
  if (cached) {
    try {
      resolved = await cachedToResolved(c.env, cached, keyHash);
      logEvent({ event: "auth_resolved", requestId, userId: resolved.userId, cacheHit: true });
    } catch {
      // Decrypt failed (rotated key / corrupt blob). Re-warm from the DB.
      resolved = null;
      logEvent({ event: "cache_decrypt_failed", requestId, reason: "stale_or_corrupt" });
    }
  }

  // ── Cache miss → single DB round-trip, then re-warm ───────────────────────
  if (!resolved) {
    // Bad/revoked keys are negatively cached, so a flood can't hit the DB.
    if (await isKeyNegativelyCached(c.env, keyHash)) {
      return c.json({ error: "invalid_api_key" }, 401);
    }
    const ctx = await getProxyContext(c.env, keyHash);
    if (!ctx) {
      await cacheNegativeKey(c.env, keyHash);
      return c.json({ error: "invalid_api_key" }, 401);
    }
    await putCachedContext(c.env, keyHash, await rpcToCached(c.env, ctx));
    resolved = rpcToResolved(ctx, keyHash);
    logEvent({ event: "auth_resolved", requestId, userId: resolved.userId, cacheHit: false });
  }

  c.set("resolved", resolved);
  await next();
});
