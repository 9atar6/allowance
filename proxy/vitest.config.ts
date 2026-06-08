import { defineConfig } from "vitest/config";

// Node environment: the worker code only uses web-standard globals (crypto.subtle,
// TransformStream, Response/Request, atob/btoa) that Node 20+ provides, so we can
// run the real Hono app in-process with stubbed bindings — fast and hermetic.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
});
