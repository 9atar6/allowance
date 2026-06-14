import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Service-role key must never be inlined into the client bundle. Keeping it
  // out of `env` here (and unprefixed) ensures it stays server-only.
  reactStrictMode: true,
  // Self-host Docker needs a standalone bundle. The Cloudflare (OpenNext) build
  // does its own transform and must NOT use standalone, so gate it on a flag
  // the Dockerfile sets. Cloudflare and dev builds use the default output.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
};

export default nextConfig;

// Lets `next dev` reach Cloudflare bindings via getCloudflareContext(). It's a
// no-op outside `next dev`, so it's safe to call unconditionally.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
