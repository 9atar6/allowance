// =============================================================================
// Static configuration / constants.
// =============================================================================

/** Base path clients hit. Everything after it is forwarded to the upstream. */
export const PROXY_BASE_PATH = "/v1/proxy";

/** KV key namespace for cached proxy contexts. */
export const KV_CTX_PREFIX = "ctx:";

/** KV key namespace for per-user monthly request counters. */
export const KV_MONTH_PREFIX = "req:";

/**
 * Free-plan monthly request quota. Hard-capped at the edge so a free account can
 * never run up unbounded infrastructure cost — calls 402 once this is reached.
 */
export const FREE_MONTHLY_REQUESTS = 5000;

/** Fallback TTL (seconds) if KV_CONTEXT_TTL_SECONDS is unset/invalid. */
export const DEFAULT_CTX_TTL = 60;

/**
 * Request headers we strip before forwarding upstream:
 *  - authorization: our proxy key, never leaks to the upstream.
 *  - host / cf-*: hop-by-hop and Cloudflare-injected.
 */
export const STRIP_REQUEST_HEADERS = [
  "authorization",
  "host",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "x-forwarded-host",
  "x-forwarded-proto",
];

/** Methods that must not carry a forwarded body. */
export const BODILESS_METHODS = new Set(["GET", "HEAD"]);
