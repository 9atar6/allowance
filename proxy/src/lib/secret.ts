// =============================================================================
// Constant-time secret comparison.
//
// Hash both inputs to a fixed-length digest first (removes any length-based
// timing signal), then compare the hex digests byte-by-byte without early exit.
// =============================================================================

import { sha256Hex } from "./hash";

export async function secretsMatch(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) {
    diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  }
  return diff === 0;
}
