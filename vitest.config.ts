import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // See test/stubs/server-only.ts -- the real package throws outside
      // Next.js's own build resolution, which would otherwise make every
      // "server-only"-marked module (Paystack, rate limiting) impossible
      // to unit test at all.
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
