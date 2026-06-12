import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Load dashboard/.env.local so local runs Just Work (Playwright does not).
// Process env always wins, so CI can override anything.
for (const file of [".env.local", ".env.staging"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

// When staging credentials exist (file or CI secrets), the whole run targets
// the staging stack: the Next server talks to the staging Supabase, the
// "Test it" action and the spec's direct calls hit the staging worker. Set
// E2E_TARGET=production to deliberately run against the live stack instead.
const STAGING_WORKER = "https://allowance-proxy-staging.6rataq.workers.dev";
const useStaging =
  process.env.E2E_TARGET !== "production" &&
  Boolean(
    process.env.STAGING_SUPABASE_URL &&
      process.env.STAGING_SUPABASE_ANON_KEY &&
      process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,
  );
if (useStaging) {
  // For the e2e helpers (run in this process, read at runtime):
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.STAGING_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.STAGING_SUPABASE_ANON_KEY;
  // For the Next server (NEXT_PUBLIC_* is inlined at build, so the server
  // reads these non-public names at runtime instead — see lib/supabase/env.ts):
  process.env.SUPABASE_URL = process.env.STAGING_SUPABASE_URL;
  process.env.SUPABASE_ANON_KEY = process.env.STAGING_SUPABASE_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  process.env.PROXY_URL = STAGING_WORKER; // server actions (Test it)
  process.env.E2E_PROXY_URL = STAGING_WORKER; // spec's direct requests
}

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // the authed journey is one ordered story
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Requires a prior `next build` (CI builds anyway; locally: npm run build).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        stdout: "pipe",
        stderr: "pipe",
      },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
