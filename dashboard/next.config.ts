import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Service-role key must never be inlined into the client bundle. Keeping it
  // out of `env` here (and unprefixed) ensures it stays server-only.
  reactStrictMode: true,
};

export default nextConfig;
