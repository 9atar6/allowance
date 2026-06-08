// =============================================================================
// Edge credential encryption — AES-256-GCM.
//
// Upstream credentials are NEVER stored in KV as plaintext. On a cache miss we
// fetch the decrypted header map from Supabase Vault (over TLS), encrypt it here
// with a worker-held key, and cache only the ciphertext. Decrypted just-in-time
// in memory per request, then discarded.
//
// Wire format: base64( iv[12] || ciphertext+tag ).
// =============================================================================

import { base64ToBytes, bytesToBase64 } from "./base64";

const IV_BYTES = 12; // GCM standard nonce length
const KEY_BYTES = 32; // AES-256

async function importKey(rawKeyB64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(rawKeyB64);
  if (raw.length !== KEY_BYTES) {
    // Fail fast — a misconfigured key must never silently weaken encryption.
    throw new Error("EDGE_ENCRYPTION_KEY must be base64 of exactly 32 bytes");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypt plaintext → base64(iv || ciphertext). Fresh random IV every call. */
export async function encryptEdge(
  rawKeyB64: string,
  plaintext: string,
): Promise<string> {
  const key = await importKey(rawKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const ctBytes = new Uint8Array(ct);
  const out = new Uint8Array(iv.length + ctBytes.length);
  out.set(iv, 0);
  out.set(ctBytes, iv.length);
  return bytesToBase64(out);
}

/** Decrypt base64(iv || ciphertext) → plaintext. Throws on tamper (GCM auth). */
export async function decryptEdge(
  rawKeyB64: string,
  payloadB64: string,
): Promise<string> {
  const key = await importKey(rawKeyB64);
  const data = base64ToBytes(payloadB64);
  const iv = data.slice(0, IV_BYTES);
  const ct = data.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}
