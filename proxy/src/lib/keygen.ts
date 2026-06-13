// =============================================================================
// Proxy key generation at the edge (for agent-minted child keys).
//
// Mirrors the dashboard's dashboard/lib/keys.ts: alw_live_ + 24 random bytes
// as url-safe base64 (~192 bits). Only the SHA-256 hash is ever persisted; the
// plaintext is returned to the caller exactly once.
// =============================================================================

import { sha256Hex } from "./hash";

const PREFIX = "alw_live_";

function base64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface GeneratedKey {
  key: string;
  keyHash: string;
  keyPrefix: string;
}

export async function generateProxyKey(): Promise<GeneratedKey> {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  const key = `${PREFIX}${token}`;
  return {
    key,
    keyHash: await sha256Hex(key),
    keyPrefix: key.slice(0, PREFIX.length + 6),
  };
}
