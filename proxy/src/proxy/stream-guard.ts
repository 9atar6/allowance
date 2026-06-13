// =============================================================================
// Mid-stream budget guard.
//
// For per-token streaming responses, a single long generation can overshoot a
// near-zero balance before settlement runs. This guard watches the running
// output cost during the stream and, when it would cross the remaining
// balance, ends the stream CLEANLY — injecting a provider-correct terminal
// frame so the client SDK sees a normal truncation (finish_reason) instead of
// a severed connection and a parse error.
//
// Honest limits:
//  - Only Anthropic reports output tokens incrementally (message_delta); for
//    OpenAI/Gemini we fall back to a conservative bytes/4 estimate, which
//    over-counts framing overhead and so stops slightly EARLY (the safe
//    direction for a cap). Authoritative settlement still uses real usage.
//  - The guard is inert unless metering is per-token AND the remaining balance
//    is finite. Normal, well-funded traffic streams through byte-for-byte.
// =============================================================================

export type StreamFormat = "openai" | "anthropic" | "unknown";

export interface GuardConfig {
  inputTokenCost: number;
  outputTokenCost: number;
  /** USD this call may still consume before we stop it. */
  balanceRemaining: number;
}

const CHARS_PER_TOKEN = 4; // coarse, intentionally conservative

/** Cheap format sniff from a frame's text, for choosing the terminal frame. */
export function detectFormat(text: string, prev: StreamFormat): StreamFormat {
  if (prev !== "unknown") return prev;
  if (text.includes('"choices"')) return "openai";
  if (text.includes('"type":"content_block') || text.includes('"message_delta"')) {
    return "anthropic";
  }
  return "unknown";
}

/**
 * A valid terminal SSE payload for the detected provider, signalling a
 * length-capped stop. Empty string for unknown formats (caller just closes).
 */
export function terminalFrame(format: StreamFormat, outputTokens: number): string {
  if (format === "openai") {
    return (
      `data: {"choices":[{"index":0,"delta":{},"finish_reason":"length"}]}\n\n` +
      `data: [DONE]\n\n`
    );
  }
  if (format === "anthropic") {
    return (
      `event: message_delta\n` +
      `data: {"type":"message_delta","delta":{"stop_reason":"max_tokens"},` +
      `"usage":{"output_tokens":${Math.max(0, Math.round(outputTokens))}}}\n\n` +
      `event: message_stop\n` +
      `data: {"type":"message_stop"}\n\n`
    );
  }
  return "";
}

/**
 * Tracks running cost across a stream. `note*` feed it signals; `exceeds()`
 * answers whether the budget boundary has been crossed.
 */
export class BudgetMeter {
  private bytes = 0;
  private promptTokens = 0;
  private reportedCompletion = 0; // real incremental count (Anthropic)

  constructor(private readonly cfg: GuardConfig) {}

  /** Raw bytes that passed through (drives the estimate fallback). */
  noteBytes(n: number): void {
    this.bytes += n;
  }

  /** Real counts parsed from the stream, when the provider reports them. */
  noteUsage(prompt: number | null, completion: number | null): void {
    if (prompt !== null && prompt > this.promptTokens) this.promptTokens = prompt;
    if (completion !== null && completion > this.reportedCompletion) {
      this.reportedCompletion = completion;
    }
  }

  private estimatedOutputTokens(): number {
    // Prefer the provider's own number; fall back to a conservative estimate.
    if (this.reportedCompletion > 0) return this.reportedCompletion;
    return this.bytes / CHARS_PER_TOKEN;
  }

  runningCost(): number {
    return (
      this.promptTokens * this.cfg.inputTokenCost +
      this.estimatedOutputTokens() * this.cfg.outputTokenCost
    );
  }

  exceeds(): boolean {
    return this.runningCost() >= this.cfg.balanceRemaining;
  }

  outputTokens(): number {
    return this.estimatedOutputTokens();
  }
}

/** A guard is only meaningful for per-token billing with a finite balance. */
export function guardApplies(
  meteringMode: string,
  balanceRemaining: number | null,
): boolean {
  return (
    meteringMode === "per_token" &&
    balanceRemaining !== null &&
    Number.isFinite(balanceRemaining) &&
    balanceRemaining > 0
  );
}
