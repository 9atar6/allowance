// =============================================================================
// Structured logging — ZERO-LOGGING discipline.
//
// This is the ONLY sanctioned log path. It accepts a fixed allowlist of safe,
// non-sensitive fields. There is deliberately no way to pass headers, bodies,
// tokens, or credentials through it.
// =============================================================================

export interface SafeLogFields {
  event: string;
  requestId?: string;
  userId?: string; // opaque uuid — not PII on its own
  endpointId?: string | null;
  status?: number;
  cacheHit?: boolean;
  durationMs?: number;
  chunks?: number;
  amount?: number; // top-up tier in USD — not sensitive
  settled?: boolean;
  reason?: string; // short machine code, e.g. "insufficient_balance"
  count?: number; // batch size for cron jobs (e.g. allowances reset)
}

export function logEvent(fields: SafeLogFields): void {
  // JSON line → Cloudflare observability. No raw request data ever included.
  console.log(JSON.stringify(fields));
}
