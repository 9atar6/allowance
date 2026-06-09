// =============================================================================
// Streaming usage extractor.
//
// Scans an SSE byte stream (or a plain JSON body) for token usage in any of the
// three major provider formats:
//
//   OpenAI:    usage.prompt_tokens / usage.completion_tokens
//   Anthropic: usage.input_tokens / usage.output_tokens
//              (streaming splits these: message_start carries input_tokens under
//               message.usage, message_delta carries final output_tokens — so
//               fields are merged across frames, last value per field wins)
//   Gemini:    usageMetadata.promptTokenCount / candidatesTokenCount
//
// Buffers across chunk boundaries so a frame split mid-bytes still parses.
// It never throws and never retains anything but the latest token counts —
// no request/response content is logged or stored.
// =============================================================================

import type { TokenUsage } from "../types";

interface PartialUsage {
  prompt?: number;
  completion?: number;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Pull whichever usage fields this object carries, in any provider format. */
function readUsage(obj: unknown): PartialUsage | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  // Anthropic message_start nests the message (with usage) under `message`.
  const container =
    o.message && typeof o.message === "object"
      ? (o.message as Record<string, unknown>)
      : o;

  // OpenAI / Anthropic: a `usage` object on the payload (or nested message).
  const u = (container.usage ?? o.usage) as Record<string, unknown> | undefined;
  if (u && typeof u === "object") {
    const prompt = num(u.prompt_tokens) ?? num(u.input_tokens);
    const completion = num(u.completion_tokens) ?? num(u.output_tokens);
    if (prompt !== undefined || completion !== undefined) {
      return { prompt, completion };
    }
  }

  // Gemini: `usageMetadata` with *TokenCount fields.
  const g = o.usageMetadata as Record<string, unknown> | undefined;
  if (g && typeof g === "object") {
    const prompt = num(g.promptTokenCount);
    const completion = num(g.candidatesTokenCount);
    if (prompt !== undefined || completion !== undefined) {
      return { prompt, completion };
    }
  }

  return null;
}

export class UsageExtractor {
  private decoder = new TextDecoder();
  private buffer = "";
  private prompt: number | null = null;
  private completion: number | null = null;

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

  /** Both sides seen → usage; otherwise null (caller falls back to flat fee). */
  result(): TokenUsage | null {
    if (this.prompt === null || this.completion === null) return null;
    return { promptTokens: this.prompt, completionTokens: this.completion };
  }

  private consume(line: string): void {
    const trimmed = line.trim();
    // Accept both raw JSON (non-stream body) and "data: {...}" SSE frames.
    const payload = trimmed.startsWith("data:")
      ? trimmed.slice(5).trim()
      : trimmed;
    if (!payload.startsWith("{")) return; // "[DONE]", comments, blanks
    try {
      const partial = readUsage(JSON.parse(payload));
      if (partial) {
        // Merge per field, last value wins (Anthropic streams them separately;
        // Gemini repeats cumulative counts — the final frame is authoritative).
        if (partial.prompt !== undefined) this.prompt = partial.prompt;
        if (partial.completion !== undefined) this.completion = partial.completion;
      }
    } catch {
      // partial / non-JSON frame — ignore
    }
  }
}
