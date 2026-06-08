// Facilitator client — delegates signature verification + on-chain settlement
// to a facilitator over HTTP, so the worker carries no chain/crypto deps.
// Works with the Coinbase CDP facilitator (auth via API key) or the free
// x402.org testnet facilitator (no auth).
import type { Env } from "../types";
import type {
  FacilitatorSettleResponse,
  FacilitatorVerifyResponse,
  X402PaymentPayload,
  X402PaymentRequirements,
} from "./types";

async function call<T>(env: Env, path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.X402_FACILITATOR_API_KEY) {
    headers.Authorization = `Bearer ${env.X402_FACILITATOR_API_KEY}`;
  }
  const res = await fetch(`${env.X402_FACILITATOR_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`facilitator ${path} -> ${res.status}`); // status only, no body
  }
  return (await res.json()) as T;
}

export function verifyPayment(
  env: Env,
  payload: X402PaymentPayload,
  requirements: X402PaymentRequirements,
): Promise<FacilitatorVerifyResponse> {
  return call(env, "/verify", {
    x402Version: 1,
    paymentPayload: payload,
    paymentRequirements: requirements,
  });
}

export function settlePayment(
  env: Env,
  payload: X402PaymentPayload,
  requirements: X402PaymentRequirements,
): Promise<FacilitatorSettleResponse> {
  return call(env, "/settle", {
    x402Version: 1,
    paymentPayload: payload,
    paymentRequirements: requirements,
  });
}
