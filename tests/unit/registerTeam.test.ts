import { describe, it, expect, vi } from "vitest";

// ── Module mocks (hoisted above all imports by Vitest) ─────────────────────
vi.mock("@/lib/stripe", async () => {
  const m = await import("@/__tests__/mocks/stripe");
  return { fetchTicketPayments: m.mockFetchTicketPayments };
});

vi.mock("@/lib/supabase", async () => {
  const m = await import("@/__tests__/mocks/supabase");
  return { supabase: { from: m.mockFrom } };
});

// ── Imports ────────────────────────────────────────────────────────────────
import { registerTeam } from "@/app/signup/[bracketType]/actions";
import { setTicketCountsByEmail } from "@/__tests__/mocks/stripe";
import { stubSupabaseTables, mockFrom } from "@/__tests__/mocks/supabase";

// ── Shared constants ───────────────────────────────────────────────────────
const REC_BRACKET_ID = "bracket-rec-1";
const TEAM_ID = "team-new-1";

const VALID_FORM = {
  teamName: "Test Team",
  contactEmail: "contact@test.com",
  player1Name: "Player One",
  player1Email: "player1@test.com",
  player2Name: "Player Two",
  player2Email: "player2@test.com",
};

function setupHappyPath() {
  setTicketCountsByEmail({
    "player1@test.com": 1,
    "player2@test.com": 1,
  });

  stubSupabaseTables({
    players: [
      { data: [], error: null },
      { data: null, error: null },
    ],
    brackets: [{ data: { id: REC_BRACKET_ID }, error: null }],
    teams: [
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: { id: TEAM_ID }, error: null },
      { data: null, error: null, count: 1 },
    ],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BUCKET 1 — Pure validation (no external calls exercised)
// ═══════════════════════════════════════════════════════════════════════════

describe("registerTeam", () => {
  describe("input validation", () => {
    it("rejects an invalid bracket type", async () => {
      // @ts-expect-error — deliberately passing an invalid bracket type
      const result = await registerTeam("invalid", VALID_FORM);
      expect(result).toEqual({ error: "Invalid bracket type." });
    });

    it("rejects a team name shorter than 2 characters", async () => {
      const result = await registerTeam("recreational", {
        ...VALID_FORM,
        teamName: "A",
      });
      expect(result).toEqual({ error: "Please provide a valid team name." });
    });

    it("rejects an empty team name", async () => {
      const result = await registerTeam("recreational", {
        ...VALID_FORM,
        teamName: "",
      });
      expect(result).toEqual({ error: "Please provide a valid team name." });
    });

    it("rejects missing player names", async () => {
      const result = await registerTeam("recreational", {
        ...VALID_FORM,
        player1Name: "",
      });
      expect(result).toEqual({ error: "Both player names are required." });
    });

    it("rejects invalid email addresses", async () => {
      const result = await registerTeam("recreational", {
        ...VALID_FORM,
        player1Email: "not-an-email",
      });
      expect(result).toEqual({
        error: "Please provide valid email addresses.",
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // BUCKET 2 — Mocked Stripe + mocked Supabase
  // ═════════════════════════════════════════════════════════════════════════

  describe("ticket eligibility", () => {
    it("rejects when no tickets are purchased", async () => {
      stubSupabaseTables({
        players: [{ data: [], error: null }],
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({
        error: expect.stringContaining("Not enough available tickets"),
      });
    });

    it("rejects when all tickets are already used by active players", async () => {
      setTicketCountsByEmail({
        "player1@test.com": 1,
        "player2@test.com": 1,
      });
      stubSupabaseTables({
        players: [
          {
            data: [
              { email: "player1@test.com" },
              { email: "player2@test.com" },
            ],
            error: null,
          },
        ],
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({
        error: expect.stringContaining("Not enough available tickets"),
      });
    });

    it("passes when enough tickets are available across team emails", async () => {
      setTicketCountsByEmail({
        "player1@test.com": 2,
        "player2@test.com": 1,
      });
      stubSupabaseTables({
        players: [
          { data: [{ email: "player1@test.com" }], error: null },
          { data: null, error: null },
        ],
        brackets: [{ data: { id: REC_BRACKET_ID }, error: null }],
        teams: [
          { data: null, error: null, count: 0 },
          { data: null, error: null, count: 0 },
          { data: { id: TEAM_ID }, error: null },
          { data: null, error: null, count: 1 },
        ],
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({ success: true, teamId: TEAM_ID });
    });

    it("allows one buyer (contact email) to cover both players", async () => {
      setTicketCountsByEmail({ "contact@test.com": 2 });
      stubSupabaseTables({
        players: [
          { data: [], error: null },
          { data: null, error: null },
        ],
        brackets: [{ data: { id: REC_BRACKET_ID }, error: null }],
        teams: [
          { data: null, error: null, count: 0 },
          { data: null, error: null, count: 0 },
          { data: { id: TEAM_ID }, error: null },
          { data: null, error: null, count: 1 },
        ],
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({ success: true, teamId: TEAM_ID });
    });

    it("includes the ticket purchase URL in the error message", async () => {
      stubSupabaseTables({
        players: [{ data: [], error: null }],
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({
        error: expect.stringContaining("https://test.example.com/tickets"),
      });
    });
  });

  describe("error handling", () => {
    it("returns an error when the active-players query fails", async () => {
      setTicketCountsByEmail({
        "player1@test.com": 1,
        "player2@test.com": 1,
      });
      stubSupabaseTables({
        players: [{ data: null, error: { message: "db error" } }],
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({
        error: "Could not verify ticket eligibility.",
      });
    });

    it("returns an error when the team-count query fails", async () => {
      setupHappyPath();
      stubSupabaseTables({
        teams: [{ data: null, error: { message: "count failed" } }],
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({
        error: "Could not verify bracket availability.",
      });
    });

    it("returns an error when team insert fails", async () => {
      setupHappyPath();
      stubSupabaseTables({
        teams: [
          { data: null, error: null, count: 0 },
          { data: null, error: null, count: 0 },
          { data: null, error: { message: "insert failed" } },
        ],
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({ error: "Failed to create team." });
    });
  });

  describe("rollback behavior", () => {
    it("rolls back the team when player insert fails", async () => {
      setupHappyPath();
      stubSupabaseTables({
        players: [
          { data: [], error: null },
          { data: null, error: { message: "player insert failed" } },
        ],
        teams: [
          { data: null, error: null, count: 0 },
          { data: null, error: null, count: 0 },
          { data: { id: TEAM_ID }, error: null },
          { data: null, error: null },
        ],
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({ error: "Failed to create players." });
      expect(mockFrom).toHaveBeenLastCalledWith("teams");
    });

    it("rolls back team and players when final count exceeds capacity", async () => {
      setupHappyPath();
      stubSupabaseTables({
        players: [
          { data: [], error: null },
          { data: null, error: null },
          { data: null, error: null },
        ],
        teams: [
          { data: null, error: null, count: 31 },
          { data: null, error: null, count: 0 },
          { data: { id: TEAM_ID }, error: null },
          { data: null, error: null, count: 33 },
          { data: null, error: null },
        ],
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({
        error:
          "This bracket filled up while you submitted. Please try another bracket.",
      });
    });
  });

  describe("normalization", () => {
    it("normalizes whitespace and casing in emails", async () => {
      setTicketCountsByEmail({
        "player1@test.com": 1,
        "player2@test.com": 1,
      });
      stubSupabaseTables({
        players: [
          { data: [], error: null },
          { data: null, error: null },
        ],
        brackets: [{ data: { id: REC_BRACKET_ID }, error: null }],
        teams: [
          { data: null, error: null, count: 0 },
          { data: null, error: null, count: 0 },
          { data: { id: TEAM_ID }, error: null },
          { data: null, error: null, count: 1 },
        ],
      });

      const result = await registerTeam("recreational", {
        ...VALID_FORM,
        player1Email: "  Player1@Test.COM  ",
        player2Email: "  PLAYER2@test.com ",
        contactEmail: " Contact@TEST.com  ",
      });

      expect(result).toEqual({ success: true, teamId: TEAM_ID });
    });
  });
});
