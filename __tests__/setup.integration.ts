import { vi, beforeEach } from "vitest";
import { resetStripeMocks } from "./mocks/stripe";

vi.mock("server-only", () => ({}));

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() ??
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
  process.env.SUPABASE_SERVICE_KEY?.trim();

if (!supabaseUrl) {
  throw new Error(
    "Integration tests require SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in your .env " +
      "(loaded by vitest.config.integration.ts via Vite loadEnv).",
  );
}
if (!serviceRoleKey) {
  throw new Error(
    "Integration tests require SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY in your .env.",
  );
}

beforeEach(() => {
  resetStripeMocks();
});
