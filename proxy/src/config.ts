// =============================================================================
// Static configuration / constants.
// =============================================================================

/** Base path clients hit. Everything after it is forwarded to the upstream. */
export const PROXY_BASE_PATH = "/v1/proxy";

/** KV key namespace for cached proxy contexts. */
export const KV_CTX_PREFIX = "ctx:";

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
