// =============================================================================
// Upstream forwarding + streaming pass-through.
//
// - Strips our auth/hop-by-hop headers, injects the user's real upstream creds.
// - Appends the sub-path after PROXY_BASE_PATH onto the configured target_url.
// - Returns the upstream Response with a counting TransformStream so SSE streams
//   pass through chunk-by-chunk while we tally chunks for telemetry.
// =============================================================================

import {
  BODILESS_METHODS,
  STRIP_REQUEST_HEADERS,
  UPSTREAM_HEADERS_TIMEOUT_MS,
} from "../config";
import type { ActiveRequest, TokenUsage } from "../types";
import {
  BudgetMeter,
  detectFormat,
  terminalFrame,
  type GuardConfig,
  type StreamFormat,
} from "./stream-guard";
import { UsageExtractor } from "./usage-meter";

export interface StreamResult {
  chunkCount: number;
  usage: TokenUsage | null;
  /** True if the budget guard ended the stream early to protect the cap. */
  stoppedForBudget?: boolean;
}

/** Join a base path and a sub-path without doubling slashes. */
function joinPath(base: string, sub: string): string {
  if (!sub || sub === "/") return base;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const s = sub.startsWith("/") ? sub : `/${sub}`;
  return `${b}${s}`;
}

/**
 * Build the upstream URL from target_url + the path/query after `prefix`.
 * `prefix` is /v1/proxy for single-endpoint keys, or /v1/proxy/{slug} for a
 * project key (so the service slug is stripped before forwarding).
 */
export function buildTargetUrl(
  reqUrl: string,
  targetUrl: string,
  prefix: string,
): string {
  const incoming = new URL(reqUrl);
  const subPath = incoming.pathname.startsWith(prefix)
    ? incoming.pathname.slice(prefix.length)
    : "";
  const target = new URL(targetUrl);
  target.pathname = joinPath(target.pathname, subPath);
  target.search = incoming.search;
  return target.toString();
}

/** Thrown when the upstream fails to return response headers within the limit. */
export class UpstreamTimeoutError extends Error {
  constructor() {
    super("upstream timed out before responding");
    this.name = "UpstreamTimeoutError";
  }
}

/**
 * Forward the incoming request to the resolved upstream endpoint.
 *
 * The timeout guards time-to-first-byte (response headers) only: a hung
 * provider can't pin the request open, but once headers arrive the timer is
 * cleared so long-lived SSE streams are never cut mid-flight.
 */
export async function forwardRequest(
  req: Request,
  active: ActiveRequest,
  timeoutMs: number = UPSTREAM_HEADERS_TIMEOUT_MS,
): Promise<Response> {
  const headers = new Headers(req.headers);
  for (const h of STRIP_REQUEST_HEADERS) headers.delete(h);

  // Inject the user's decrypted upstream credentials (in-memory only).
  for (const [name, value] of Object.entries(active.upstreamHeaders)) {
    headers.set(name, value);
  }

  const method = req.method.toUpperCase();
  const url = buildTargetUrl(req.url, active.targetUrl, active.proxyPrefix);

  const aborter = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    aborter.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      method,
      headers,
      body: BODILESS_METHODS.has(method) ? undefined : req.body,
      signal: aborter.signal,
      // Required by Workers to stream a request body upstream.
      // @ts-expect-error duplex isn't in the lib DOM RequestInit typings yet.
      duplex: "half",
    });
  } catch (err) {
    if (timedOut) throw new UpstreamTimeoutError();
    throw err;
  } finally {
    clearTimeout(timer); // headers arrived (or failed) — never abort the body
  }
}

/**
 * Wrap an upstream Response so its body streams straight to the client while we
 * count chunks.
 *
 * Returns the client `response` plus a `done` promise that RESOLVES TO THE CHUNK
 * COUNT once the stream fully drains (or the client/upstream aborts). The caller
 * registers `done` with ctx.waitUntil() ONCE, synchronously, before returning —
 * and chains settlement off it. (Calling waitUntil() from inside a stream
 * callback after the handler returns is a no-op on Cloudflare, which would drop
 * settlement entirely — hence this shape.)
 */
export function streamWithCount(
  upstream: Response,
  guard?: GuardConfig,
): {
  response: Response;
  done: Promise<StreamResult>;
} {
  // No body (e.g. 204) — nothing to stream.
  if (!upstream.body) {
    return { response: upstream, done: Promise.resolve({ chunkCount: 0, usage: null }) };
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const reader = upstream.body.getReader();
  const writer = writable.getWriter();
  const meter = new UsageExtractor();
  const budget = guard ? new BudgetMeter(guard) : null;
  const encoder = budget ? new TextEncoder() : null;
  const decoder = budget ? new TextDecoder() : null;

  const done = (async (): Promise<StreamResult> => {
    let chunkCount = 0;
    let stoppedForBudget = false;
    let format: StreamFormat = "unknown";
    try {
      for (;;) {
        const { done: finished, value } = await reader.read();
        if (finished) break;
        chunkCount++;
        meter.push(value); // scan for token usage as bytes pass through
        await writer.write(value);

        if (budget && decoder && encoder) {
          budget.noteBytes(value.byteLength);
          const seen = meter.current();
          budget.noteUsage(seen.prompt, seen.completion);
          format = detectFormat(decoder.decode(value, { stream: true }), format);
          if (budget.exceeds()) {
            // Inject a clean terminal frame so the client SDK sees a normal
            // truncation, then stop reading from upstream.
            const frame = terminalFrame(format, budget.outputTokens());
            if (frame) await writer.write(encoder.encode(frame));
            stoppedForBudget = true;
            await reader.cancel().catch(() => undefined);
            break;
          }
        }
      }
    } catch {
      // Client disconnect / upstream abort — settle with what we counted.
    } finally {
      await writer.close().catch(() => undefined);
    }
    meter.end();
    return { chunkCount, usage: meter.result(), stoppedForBudget };
  })();

  const response = new Response(readable, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers, // preserves content-type incl. text/event-stream
  });

  return { response, done };
}
