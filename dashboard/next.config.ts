import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Service-role key must never be inlined into the client bundle. Keeping it
  // out of `env` here (and unprefixed) ensures it stays server-only.
  reactStrictMode: true,
  // Self-host: emit a standalone server bundle for the Docker image. Vercel
  // ignores this and builds normally, so it's safe to always set.
  output: "standalone",
};

export default nextConfig;
