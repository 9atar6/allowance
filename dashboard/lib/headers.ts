// Parsing user-supplied upstream auth headers. Pure + framework-free so it can
// be unit-tested in isolation.

/**
 * Parse "Header-Name: value" lines into a header map.
 * Returns null if any non-blank line is malformed, or if the result is empty —
 * the caller treats null as a validation failure.
 */
export function parseHeaders(raw: string): Record<string, string> | null {
  const map: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx < 1) return null; // no colon, or colon at position 0 (empty name)
    const name = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!name || !value) return null;
    map[name] = value;
  }
  return Object.keys(map).length ? map : null;
}
