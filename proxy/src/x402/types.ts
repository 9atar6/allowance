// =============================================================================
// x402 protocol types (exact scheme, EVM/USDC).
//
// Targets x402Version 1 — the most widely deployed shape (Coinbase CDP and the
// x402.org facilitators). The exact wire format is the one thing to confirm
// against your chosen facilitator at integration time; it's isolated here and
// in facilitator.ts so it's a one-file adjustment.
// =============================================================================

/** What the resource server advertises in a 402 (one entry of `accepts`). */
export interface X402PaymentRequirements {
  scheme: "exact";
  network: string; // e.g. "base-sepolia" | "base"
  maxAmountRequired: string; // atomic token units, as a string
  resource: string;
  description: string;
  mimeType: string;
  payTo: string; // our receiving wallet address
  maxTimeoutSeconds: number;
  asset: string; // token contract address (USDC)
  extra?: Record<string, unknown>; // e.g. { name: "USDC", version: "2" }
}

/** Decoded X-PAYMENT header content sent by the paying client. */
export interface X402PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: unknown; // signature + authorization (scheme-specific)
}

export interface FacilitatorVerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

export interface FacilitatorSettleResponse {
  success: boolean;
  transaction?: string; // on-chain tx hash (used as idempotency key)
  network?: string;
  payer?: string;
  errorReason?: string;
}
