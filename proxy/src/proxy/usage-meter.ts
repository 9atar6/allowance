// =============================================================================
// Streaming usage extractor.
//
// Scans an SSE byte stream for an OpenAI-style `usage` object (emitted in the
// final frame when the client passes stream_options.include_usage, and present
// in the body of non-streaming JSON responses). Buffers across chunk boundaries
// so a frame split mid-bytes is still parsed correctly.
//
// It never throws and never retains anything but the latest token counts —
// no request/response content is logged or stored.
// =============================================================================

import type { TokenUsage } from "../types";

interface RawUsage {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
}

function readUsage(obj: unknown): TokenUsage | null {
  if (!obj || typeof obj !== "object") return null;
  const u = (obj as { usage?: RawUsage }).usage;
  if (!u || typeof u !== "object") return null;
  const prompt = u.prompt_tokens;
  const completion = u.completion_tokens;
  if (typeof prompt === "number" && typeof completion === "number") {
    return { promptTokens: prompt, completionTokens: completion };
  }
  return null;
}

export class UsageExtractor {
  private decoder = new TextDecoder();
  private buffer = "";
  private usage: TokenUsage | null = null;

  /** Feed a raw stream chunk. */
  push(chunk: Uint8Array): void {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      this.consume(line);
    }
  }

  /** Flush any trailing buffered line (call once the stream ends). */
  end(): void {
    if (this.buffer.length > 0) {
      this.consume(this.buffer);
      this.buffer = "";
    }
  }

  result(): TokenUsage | null {
    return this.usage;
  }

  private consume(line: string): void {
    const trimmed = line.trim();
    // Accept both raw JSON (non-stream body) and "data: {...}" SSE frames.
    const payload = trimmed.startsWith("data:")
      ? trimmed.slice(5).trim()
      : trimmed;
    if (!payload.startsWith("{")) return; // "[DONE]", comments, blanks
    try {
      const parsed = readUsage(JSON.parse(payload));
      if (parsed) this.usage = parsed; // last usage wins
    } catch {
      // partial / non-JSON frame — ignore
    }
  }
}
