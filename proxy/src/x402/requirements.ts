// Build x402 payment requirements + USD→atomic conversion.
import type { Env } from "../types";
import type { X402PaymentRequirements } from "./types";

/** Fixed top-up tiers (USD). x402 "exact" needs a known price up front. */
export const TOPUP_TIERS = [5, 10, 25, 50, 100] as const;
export type TopupTier = (typeof TOPUP_TIERS)[number];

export function isValidTier(n: number): n is TopupTier {
  return (TOPUP_TIERS as readonly number[]).includes(n);
}

function assetDecimals(env: Env): number {
  const d = Number(env.X402_ASSET_DECIMALS);
  return Number.isFinite(d) && d > 0 ? d : 6; // USDC = 6 decimals
}

/** USD (e.g. 5) → atomic token units string (e.g. "5000000" for 6-dp USDC). */
export function usdToAtomic(usd: number, decimals: number): string {
  return BigInt(Math.round(usd * 10 ** decimals)).toString();
}

export function buildRequirements(
  env: Env,
  usd: number,
  resourceUrl: string,
): X402PaymentRequirements {
  return {
    scheme: "exact",
    network: env.X402_NETWORK!,
    maxAmountRequired: usdToAtomic(usd, assetDecimals(env)),
    resource: resourceUrl,
    description: `Top up your Allowance balance by $${usd}`,
    mimeType: "application/json",
    payTo: env.X402_RECEIVING_WALLET!,
    maxTimeoutSeconds: 120,
    asset: env.X402_ASSET!,
    extra: { name: "USDC", version: "2" },
  };
}

/** True only when every required x402 env var is present. */
export function x402Configured(env: Env): boolean {
  return Boolean(
    env.X402_RECEIVING_WALLET &&
      env.X402_FACILITATOR_URL &&
      env.X402_NETWORK &&
      env.X402_ASSET,
  );
}
