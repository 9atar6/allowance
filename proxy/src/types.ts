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

  // Supabase (service_role — backend only, never exposed).
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Lago metering.
  LAGO_API_URL: string;
  LAGO_API_KEY: string;
  LAGO_EVENT_CODE: string;

  // Edge credential encryption (base64 of 32 random bytes).
  EDGE_ENCRYPTION_KEY: string;

  // Shared secret for the /admin/purge endpoint (dashboard → worker). If unset,
  // purge is disabled and revocation falls back to TTL expiry.
  ADMIN_PURGE_SECRET?: string;

  // x402 crypto top-up rail. All optional — if any is unset, /v1/topup 503s
  // (dormant until configured).
  X402_RECEIVING_WALLET?: string; // wallet address that receives USDC
  X402_FACILITATOR_URL?: string; // e.g. https://x402.org/facilitator (testnet)
  X402_FACILITATOR_API_KEY?: string; // bearer for CDP facilitator (optional)
  X402_NETWORK?: string; // e.g. "base-sepolia" | "base"
  X402_ASSET?: string; // USDC contract address on that network
  X402_ASSET_DECIMALS?: string; // defaults to 6 (USDC)

  KV_CONTEXT_TTL_SECONDS: string;
}

/**
 * Shape returned by the `get_proxy_context` RPC.
 * `upstream_header` is the DECRYPTED JSON header map (plaintext from Vault) —
 * it exists in memory only and is never logged or cached in plaintext.
 */
export type MeteringMode = "flat" | "per_token";

/** Token usage parsed from an upstream response (OpenAI-style `usage`). */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface RpcProxyContext {
  user_id: string;
  balance: number;
  endpoint_id: string | null;
  target_url: string | null;
  cost_per_request: number;
  metering_mode: MeteringMode;
  input_token_cost: number;
  output_token_cost: number;
  endpoint_active: boolean;
  upstream_header: string | null; // JSON string: { "Authorization": "Bearer ..." }
}

/**
 * What we persist in KV: identical metadata, but the credential is stored as
 * AES-GCM ciphertext (`upstream_header_enc`) — encrypted credentials at the edge.
 */
export interface CachedProxyContext {
  user_id: string;
  balance: number;
  endpoint_id: string | null;
  target_url: string | null;
  cost_per_request: number;
  metering_mode: MeteringMode;
  input_token_cost: number;
  output_token_cost: number;
  endpoint_active: boolean;
  upstream_header_enc: string | null; // AES-GCM ciphertext (iv-prefixed, base64)
  cached_at: number;
}

/** Fully-resolved, in-memory context the request handler works with. */
export interface ResolvedContext {
  userId: string;
  balance: number;
  endpointId: string | null;
  targetUrl: string | null;
  costPerRequest: number;
  meteringMode: MeteringMode;
  inputTokenCost: number;
  outputTokenCost: number;
  endpointActive: boolean;
  upstreamHeaders: Record<string, string>;
  keyHash: string;
}

/** Hono context variable map. */
export interface Variables {
  resolved: ResolvedContext;
  requestId: string;
}
