import { vi, beforeEach } from "vitest";
import { resetStripeMocks } from "./mocks/stripe";
import { resetSupabaseMocks } from "./mocks/supabase";

vi.mock("server-only", () => ({}));

process.env.PARTICIPANT_TICKET_URL = "https://test.example.com/tickets";

beforeEach(() => {
  resetStripeMocks();
  resetSupabaseMocks();
});
