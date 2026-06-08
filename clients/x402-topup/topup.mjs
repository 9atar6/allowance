// =============================================================================
// Allowance x402 top-up test client.
//
// Pays a /v1/topup/:amount endpoint with USDC on Base Sepolia. x402-fetch
// auto-handles the 402 challenge: it parses the payment requirements, signs an
// EIP-3009 USDC authorization with the wallet, and retries with X-PAYMENT.
//
// Run:
//   cd clients/x402-topup
//   npm install
//   $env:X402_TEST_PRIVATE_KEY="0x..."   # the funded Base Sepolia account
//   $env:ALLOWANCE_KEY="alw_live_..."     # any active Allowance proxy key
//   node topup.mjs
// =============================================================================

import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";

const PRIVATE_KEY = process.env.X402_TEST_PRIVATE_KEY;
const ALLOWANCE_KEY = process.env.ALLOWANCE_KEY;
const WORKER_URL =
  process.env.WORKER_URL || "https://api-wallet-proxy.6rataq.workers.dev";
const AMOUNT = process.env.TOPUP_AMOUNT || "5"; // tier: 5/10/25/50/100

if (!PRIVATE_KEY || !ALLOWANCE_KEY) {
  console.error("Missing env: set X402_TEST_PRIVATE_KEY and ALLOWANCE_KEY.");
  process.exit(1);
}

const pk = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
const account = privateKeyToAccount(pk);
const wallet = createWalletClient({
  account,
  transport: http(),
  chain: baseSepolia,
});

// Cap the auto-payment well above our tiers so x402-fetch doesn't refuse it.
const fetchWithPay = wrapFetchWithPayment(fetch, wallet, BigInt(200_000_000)); // 200 USDC cap

const url = `${WORKER_URL}/v1/topup/${AMOUNT}`;
console.log(`Payer:   ${account.address}`);
console.log(`Topping up $${AMOUNT} via ${url}\n`);

try {
  const res = await fetchWithPay(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ALLOWANCE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  console.log(`HTTP ${res.status}`);
  const body = await res.text();
  console.log("Body:", body);

  const receipt = res.headers.get("x-payment-response");
  if (receipt) {
    const decoded = JSON.parse(Buffer.from(receipt, "base64").toString("utf8"));
    console.log("\nSettlement receipt:", decoded);
    if (decoded.transaction) {
      console.log(
        `Explorer: https://sepolia.basescan.org/tx/${decoded.transaction}`,
      );
    }
  }
} catch (err) {
  console.error("\nPayment failed:", err?.message ?? err);
  process.exit(1);
}
