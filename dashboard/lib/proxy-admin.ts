import "server-only";

// Calls the worker's /admin/purge to evict a revoked key's edge cache so
// revocation is immediate. Best-effort: if the worker is unreachable or
// unconfigured, the proxy's KV TTL is the backstop — never block revocation.

export async function purgeProxyKeyCache(keyHash: string): Promise<void> {
  const url = process.env.PROXY_ADMIN_URL;
  const secret = process.env.PROXY_PURGE_SECRET;
  if (!url || !secret) return; // not configured → rely on TTL expiry

  try {
    await fetch(`${url}/admin/purge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ keyHash }),
    });
  } catch {
    // Worker unreachable — TTL expiry will still revoke within the cache window.
  }
}
