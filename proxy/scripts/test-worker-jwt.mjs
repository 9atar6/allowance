// Diagnose the restricted proxy_worker JWT: mint it from SUPABASE_JWT_SECRET
// and call get_proxy_context directly, printing Supabase's exact response.
// Never prints the secret or the token.
//
// Usage (cmd):
//   set SUPABASE_JWT_SECRET=...
//   node proxy/scripts/test-worker-jwt.mjs
//   set SUPABASE_JWT_SECRET=

import { createHmac } from "node:crypto";

const SUPABASE_URL = "https://izcxmonodmfoebaazxxe.supabase.co";

const secret = process.env.SUPABASE_JWT_SECRET;
if (!secret) {
  console.error("Set SUPABASE_JWT_SECRET first (the Legacy JWT secret).");
  process.exit(1);
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const data = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
  role: "proxy_worker",
  iss: "supabase",
  iat: now,
  exp: now + 3600,
})}`;
const token = `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_proxy_context`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: token,
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ p_key_hash: "deadbeef" }),
});

console.log("STATUS:", res.status);
console.log("BODY:", await res.text());
console.log(
  res.status === 200
    ? "RESULT: the restricted token works. The minted key you uploaded should too."
    : "RESULT: rejected. Send the STATUS and BODY lines above to Claude.",
);
