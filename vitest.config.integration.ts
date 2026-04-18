import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Merge `.env`, `.env.local`, `.env.test`, etc. into `process.env` before test
// modules import `@/lib/supabase` or integration helpers.
const root = path.dirname(fileURLToPath(import.meta.url));
Object.assign(process.env, loadEnv("test", root, ""));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./__tests__/setup.integration.ts"],
    testTimeout: 15_000,
    /** One shared local DB — run files sequentially to avoid cleanup races. */
    fileParallelism: false,
  },
});
