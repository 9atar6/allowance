import { defineConfig } from "vitest/config";

// Node environment: the worker code only uses web-standard globals (crypto.subtle,
// TransformStream, Response/Request, atob/btoa) that Node 20+ provides, so we can
// run the real Hono app in-process with stubbed bindings — fast and hermetic.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // Floors sit just under current coverage (≈83% lines) — they may only
      // ratchet UP. CI fails if a change drops below.
      thresholds: { lines: 78, statements: 78, functions: 72, branches: 70 },
    },
  },
});
