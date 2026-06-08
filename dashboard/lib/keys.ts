import "server-only";

// Proxy key generation. The plaintext key is shown to the user EXACTLY once at
// creation; only its SHA-256 hash is ever persisted (via issue_proxy_key).
import { createHash, randomBytes } from "crypto";

const PREFIX = process.env.PROXY_KEY_PREFIX || "alw_live_";

export interface GeneratedKey {
  key: string; // full plaintext — return to user once, never store
  keyHash: string; // hex SHA-256 — what the proxy matches on
  keyPrefix: string; // non-secret display prefix
}

export function generateProxyKey(): GeneratedKey {
  // 24 random bytes → 32-char url-safe token. ~192 bits of entropy.
  const token = randomBytes(24).toString("base64url");
  const key = `${PREFIX}${token}`;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const keyPrefix = key.slice(0, PREFIX.length + 6); // prefix + 6 chars
  return { key, keyHash, keyPrefix };
}
