// =============================================================================
// Shared types for the Allowance proxy.
// =============================================================================

/**
 * Cloudflare Rate Limiting binding (open beta — not yet in @cloudflare/workers-types).
 * `limit()` returns `{ success: false }` once the configured threshold is hit.
 */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Cloudflare Worker bindings + env (wrangler vars/secrets). */
export interface Env {
  WALLET_KV: KVNamespace;

  // Per-key edge rate limiter. Optional so the worker fails OPEN if unbound.
  RATE_LIMITER?: RateLimit;
  // Per-IP pre-auth limiter (blocks raw floods before key resolution).
  RATE_LIMITER_IP?: RateLimit;

  // Supabase (service_role — backend only, never exposed).
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Edge credential encryption (base64 of 32 random bytes).
  EDGE_ENCRYPTION_KEY: string;

  // Low-balance alert email (Resend). All optional — if RESEND_API_KEY is unset,
  // the scheduled alert job no-ops.
  RESEND_API_KEY?: string;
  RESEND_FROM?: string; // e.g. "Allowance <onboarding@resend.dev>"
  APP_URL?: string; // dashboard origin, for the top-up link in the email

  // Shared secret for the /admin/purge endpoint (dashboard → worker). If unset,
  // purge is disabled and revocation falls back to TTL expiry.
  ADMIN_PURGE_SECRET?: string;

  // Optional Slack/Discord-style incoming webhook for error alerts. No-op if unset.
  ALERT_WEBHOOK_URL?: string;

  KV_CONTEXT_TTL_SECONDS: string;
}

/**
 * Shape returned by the `get_proxy_context` RPC.
 * `upstream_header` is the DECRYPTED JSON header map (plaintext from Vault) —
 * it exists in memory only and is never logged or cached in plaintext.
 */
export type MeteringMode = "flat" | "per_token";

/** Billing tier — drives the free-plan monthly request cap at the edge. */
export type PlanTier = "free" | "pro" | "enterprise";

/** Token usage parsed from an upstream response (OpenAI-style `usage`). */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/** One service inside a project, keyed by slug (credential still plaintext here). */
export interface RpcRoute {
  slug: string | null;
  endpoint_id: string;
  target_url: string;
  cost_per_request: number;
  metering_mode: MeteringMode;
  input_token_cost: number;
  output_token_cost: number;
  upstream_header: string | null; // decrypted JSON header map
}

/**
 * Shape from get_proxy_context. A single-endpoint key carries the flat fields;
 * a project key carries `routes` (one per service). Both carry `daily_limit`
 * (null = unlimited). Credentials are plaintext here, in memory only.
 */
export interface RpcProxyContext {
  user_id: string;
  balance: number;
  plan?: PlanTier;
  daily_limit: number | null;
  monthly_limit?: number | null; // per-key monthly USD cap (null = none)
  // single-endpoint (legacy) key:
  endpoint_id?: string | null;
  target_url?: string | null;
  cost_per_request?: number;
  metering_mode?: MeteringMode;
  input_token_cost?: number;
  output_token_cost?: number;
  endpoint_active?: boolean;
  upstream_header?: string | null;
  // project key:
  project_id?: string | null;
  monthly_budget?: number | null; // project-wide monthly USD cap (null = none)
  routes?: RpcRoute[] | null;
}

/** A route cached at the edge: credential stored as AES-GCM ciphertext. */
export interface CachedRoute {
  slug: string | null;
  endpoint_id: string;
  target_url: string;
  cost_per_request: number;
  metering_mode: MeteringMode;
  input_token_cost: number;
  output_token_cost: number;
  upstream_header_enc: string | null;
}

export interface CachedSingle extends CachedRoute {
  endpoint_active: boolean;
}

export interface CachedProxyContext {
  user_id: string;
  balance: number;
  plan: PlanTier;
  daily_limit: number | null;
  monthly_limit?: number | null; // per-key monthly USD cap (null = none)
  project_id: string | null;
  monthly_budget: number | null;
  single: CachedSingle | null;
  routes: CachedRoute[] | null;
  cached_at: number;
}

/** One endpoint, decrypted, ready to serve. */
export interface ResolvedEndpoint {
  slug: string | null;
  endpointId: string;
  targetUrl: string;
  costPerRequest: number;
  meteringMode: MeteringMode;
  inputTokenCost: number;
  outputTokenCost: number;
  upstreamHeaders: Record<string, string>;
}

/** Key-level context (single endpoint OR project routes) set by auth middleware. */
export interface ResolvedContext {
  userId: string;
  balance: number;
  plan: PlanTier;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  projectId: string | null;
  monthlyBudget: number | null;
  keyHash: string;
  single: (ResolvedEndpoint & { endpointActive: boolean }) | null;
  routes: ResolvedEndpoint[] | null;
}

/** The endpoint chosen for a single request, plus the key context it needs. */
export interface ActiveRequest {
  userId: string;
  keyHash: string;
  projectId: string | null;
  balance: number;
  endpointId: string;
  targetUrl: string;
  costPerRequest: number;
  meteringMode: MeteringMode;
  inputTokenCost: number;
  outputTokenCost: number;
  upstreamHeaders: Record<string, string>;
  proxyPrefix: string; // path to strip when forwarding
}

/** Hono context variable map. */
export interface Variables {
  resolved: ResolvedContext;
  requestId: string;
}
