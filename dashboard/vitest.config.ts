import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Neutralise the server-only guard so server modules are testable.
      "server-only": path.resolve(process.cwd(), "test/stubs/server-only.ts"),
      // Mirror the "@/*" path alias from tsconfig.
      "@": path.resolve(process.cwd()),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**"],
      // Floors sit just under current coverage (untested files are thin
      // Supabase client wrappers). Ratchet up as tests grow.
      thresholds: { lines: 50, statements: 50, functions: 30, branches: 70 },
    },
  },
});
