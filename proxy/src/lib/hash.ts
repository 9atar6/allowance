// =============================================================================
// One-way hashing. The proxy key is matched by SHA-256 hash (never stored raw).
// =============================================================================

/** Hex SHA-256 of an input string, using WebCrypto (available in Workers). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
