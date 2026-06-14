// OpenNext adapter config for deploying this Next.js app to Cloudflare Workers.
// Default config: no incremental cache backend wired yet (the dashboard is
// dynamic + auth-gated, so there's little to cache). Add R2/KV here later if
// we introduce ISR.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
