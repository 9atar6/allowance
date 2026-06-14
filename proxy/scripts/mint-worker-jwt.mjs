// Mint a long-lived JWT for the restricted `proxy_worker` Postgres role.
//
// Usage (PowerShell):
//   $env:SUPABASE_JWT_SECRET = "<paste the Legacy JWT secret>"
//   node proxy/scripts/mint-worker-jwt.mjs
//   Remove-Item Env:SUPABASE_JWT_SECRET
//
// The output token can ONLY execute the RPCs granted to proxy_worker in
// db/schema.sql. Set it as the worker's SUPABASE_SERVICE_ROLE_KEY secret.
// Runs locally with zero dependencies; the secret never leaves your machine.

import { createHmac } from "node:crypto";

const secret = process.env.SUPABASE_JWT_SECRET;
if (!secret) {
  console.error(
    "Set SUPABASE_JWT_SECRET to your project's Legacy JWT secret first.\n" +
      "Find it at: Supabase Dashboard > Project Settings > API > JWT Settings.",
  );
  process.exit(1);
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;

const header = { alg: "HS256", typ: "JWT" };
const payload = {
  role: "proxy_worker",
  iss: "supabase",
  iat: now,
  exp: now + TEN_YEARS_SECONDS,
};

const data = `${b64(header)}.${b64(payload)}`;
const signature = createHmac("sha256", secret).update(data).digest("base64url");

console.log(`${data}.${signature}`);
