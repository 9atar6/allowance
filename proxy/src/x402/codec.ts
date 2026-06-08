// X-PAYMENT / X-PAYMENT-RESPONSE header codec (base64 of JSON).
import { base64ToBytes, bytesToBase64 } from "../lib/base64";
import type { X402PaymentPayload } from "./types";

/** Decode the client's X-PAYMENT header. Returns null on malformed input. */
export function decodeXPayment(header: string): X402PaymentPayload | null {
  try {
    const json = new TextDecoder().decode(base64ToBytes(header));
    const obj = JSON.parse(json);
    if (obj && typeof obj === "object") return obj as X402PaymentPayload;
  } catch {
    /* malformed */
  }
  return null;
}

/** Encode the settlement receipt for the X-PAYMENT-RESPONSE header. */
export function encodeXPaymentResponse(value: unknown): string {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(value)));
}
