/**
 * Integration tests for registerTeam.
 *
 * These hit a **real local Supabase** (tables, constraints, foreign keys) and
 * only mock Stripe. Run `supabase start` before executing this suite.
 *
 *   npm run test:integration
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// ── Mock Stripe only — Supabase is real ────────────────────────────────────
vi.mock("@/lib/stripe", async () => {
  const m = await import("@/__tests__/mocks/stripe");
  return { fetchTicketPayments: m.mockFetchTicketPayments };
});
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-user" })),
}));

// ── Imports ────────────────────────────────────────────────────────────────
import { registerTeam } from "@/app/signup/[bracketType]/actions";
import { setTicketCountsByEmail } from "@/__tests__/mocks/stripe";
import { requireAdmin } from "@/lib/auth";
import {
  seedBrackets,
  seedTeams,
  cleanupTestData,
  testDb,
} from "@/__tests__/helpers/integration-db";

// ── Shared constants ───────────────────────────────────────────────────────
const VALID_FORM = {
  teamName: "Test Team",
  contactEmail: "contact@test.com",
  player1Name: "Player One",
  player1Email: "player1@test.com",
  player2Name: "Player Two",
  player2Email: "player2@test.com",
};

let brackets: Record<string, string>;

beforeEach(async () => {
  await cleanupTestData();
  const seed = await seedBrackets();
  brackets = seed.brackets;
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-user" } as never);

  setTicketCountsByEmail({
    "player1@test.com": 1,
    "player2@test.com": 1,
  });
});

afterAll(async () => {
  await cleanupTestData();
});

// ═══════════════════════════════════════════════════════════════════════════
// BUCKET 3 — Real local Supabase + mocked Stripe
// ═══════════════════════════════════════════════════════════════════════════

describe("registerTeam (integration)", () => {
  // ── Happy path ─────────────────────────────────────────────────────────
  describe("happy path", () => {
    it("creates a team and returns the team ID", async () => {
      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({
        success: true,
        teamId: expect.any(String),
      });

      if ("teamId" in result) {
        const { data: team } = await testDb
          .from("teams")
          .select("name, contact_email, bracket_id")
          .eq("id", result.teamId)
          .single();

        expect(team).toMatchObject({
          name: "Test Team",
          contact_email: "contact@test.com",
          bracket_id: brackets.recreational,
        });
      }
    });

    it("works for the competitive bracket type", async () => {
      const result = await registerTeam("competitive", VALID_FORM);

      expect(result).toEqual({
        success: true,
        teamId: expect.any(String),
      });

      if ("teamId" in result) {
        const { data: team } = await testDb
          .from("teams")
          .select("bracket_id")
          .eq("id", result.teamId)
          .single();

        expect(team?.bracket_id).toBe(brackets.competitive);
      }
    });

    it("inserts both players linked to the new team", async () => {
      const result = await registerTeam("recreational", VALID_FORM);
      expect(result).toHaveProperty("teamId");

      if ("teamId" in result) {
        const { data: players } = await testDb
          .from("players")
          .select("name, email")
          .eq("team_id", result.teamId)
          .order("name");

        expect(players).toEqual([
          { name: "Player One", email: "player1@test.com" },
          { name: "Player Two", email: "player2@test.com" },
        ]);
      }
    });

    it("persists normalized contact and player emails", async () => {
      setTicketCountsByEmail({
        "player1@test.com": 2,
      });

      const result = await registerTeam("recreational", {
        ...VALID_FORM,
        contactEmail: "  CONTACT@TEST.COM  ",
        player1Email: "  PLAYER1@Test.COM ",
        player2Email: " PLAYER1@test.com ",
      });
      expect(result).toHaveProperty("teamId");

      if ("teamId" in result) {
        const { data: team } = await testDb
          .from("teams")
          .select("contact_email")
          .eq("id", result.teamId)
          .single();

        const { data: players } = await testDb
          .from("players")
          .select("email")
          .eq("team_id", result.teamId)
          .order("email");

        expect(team?.contact_email).toBe("contact@test.com");
        expect(players?.map((p) => p.email)).toEqual([
          "player1@test.com",
          "player1@test.com",
        ]);
      }
    });
  });

  // ── Bracket lookup ─────────────────────────────────────────────────────
  describe("bracket lookup", () => {
    it("rejects when the bracket does not exist", async () => {
      await cleanupTestData();
      // Seed only recreational — competitive will be missing
      await seedBrackets(["recreational"]);

      const result = await registerTeam("competitive", VALID_FORM);

      expect(result).toEqual({ error: "Bracket not found." });
    });
  });

  // ── Capacity enforcement ───────────────────────────────────────────────
  describe("capacity enforcement", () => {
    it("rejects when the bracket is full (32 teams)", async () => {
      await seedTeams(brackets.recreational, 32);

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({ error: "This bracket is full." });
    });

    it("fills remaining slot then rejects the next registration", async () => {
      await seedTeams(brackets.recreational, 31);
      setTicketCountsByEmail({
        "player1@test.com": 2,
        "player2@test.com": 2,
        "p3@test.com": 1,
        "p4@test.com": 1,
      });

      const first = await registerTeam("recreational", {
        ...VALID_FORM,
        contactEmail: "first@test.com",
      });
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      const second = await registerTeam("recreational", {
        ...VALID_FORM,
        contactEmail: "second@test.com",
        player1Email: "p3@test.com",
        player2Email: "p4@test.com",
      });
      expect(second).toEqual({ error: "This bracket is full." });
    });
  });

  // ── Duplicate prevention ───────────────────────────────────────────────
  describe("duplicate prevention", () => {
    it("rejects when the contact email already has a team in the bracket", async () => {
      await testDb.from("teams").insert({
        bracket_id: brackets.recreational,
        name: "Existing Team",
        contact_email: "contact@test.com",
        is_active: true,
      });

      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({
        error:
          "This email has already registered a team for this bracket.",
      });
    });

    it("allows same contact email across different brackets", async () => {
      setTicketCountsByEmail({
        "contact@test.com": 4,
      });

      const first = await registerTeam("recreational", {
        ...VALID_FORM,
        contactEmail: "contact@test.com",
        player1Email: "contact@test.com",
        player2Email: "p2@test.com",
      });
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      const second = await registerTeam("competitive", {
        ...VALID_FORM,
        teamName: "Comp Team",
        contactEmail: "contact@test.com",
        player1Email: "contact@test.com",
        player2Email: "p3@test.com",
      });
      expect(second).toEqual({ success: true, teamId: expect.any(String) });
    });

    it("blocks same contact email in same bracket without override when tickets are sufficient", async () => {
      setTicketCountsByEmail({
        "contact@test.com": 4,
      });

      const first = await registerTeam("recreational", {
        ...VALID_FORM,
        contactEmail: "contact@test.com",
        player1Email: "contact@test.com",
        player2Email: "p2@test.com",
      });
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      const second = await registerTeam("recreational", {
        ...VALID_FORM,
        teamName: "Second Team",
        contactEmail: "contact@test.com",
        player1Email: "contact@test.com",
        player2Email: "p3@test.com",
      });
      expect(second).toEqual({
        error: "This email has already registered a team for this bracket.",
      });
    });

    it("allows same contact email in same bracket when previous team is inactive", async () => {
      setTicketCountsByEmail({
        "contact@test.com": 4,
      });

      const first = await registerTeam("recreational", {
        ...VALID_FORM,
        contactEmail: "contact@test.com",
        player1Email: "contact@test.com",
        player2Email: "p2@test.com",
      });
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      if ("teamId" in first) {
        await testDb.from("teams").update({ is_active: false }).eq("id", first.teamId);
      }

      const second = await registerTeam("recreational", {
        ...VALID_FORM,
        teamName: "Second Team After Withdrawal",
        contactEmail: "contact@test.com",
        player1Email: "contact@test.com",
        player2Email: "p3@test.com",
      });
      expect(second).toEqual({ success: true, teamId: expect.any(String) });
    });
  });

  // ── Admin payment-override mode ────────────────────────────────────────
  describe("admin payment override", () => {
    it("allows registration without purchased tickets when enforcePayment=false", async () => {
      const result = await registerTeam(
        "recreational",
        {
          ...VALID_FORM,
          contactEmail: "override@test.com",
          player1Email: "override-p1@test.com",
          player2Email: "override-p2@test.com",
        },
        { enforcePayment: false },
      );

      expect(result).toEqual({ success: true, teamId: expect.any(String) });
      expect(requireAdmin).toHaveBeenCalledTimes(1);
    });

    it("denies override when admin auth fails", async () => {
      vi.mocked(requireAdmin).mockRejectedValueOnce(
        new Error("Admin privileges required."),
      );

      const result = await registerTeam(
        "recreational",
        {
          ...VALID_FORM,
          contactEmail: "blocked@test.com",
          player1Email: "blocked-p1@test.com",
          player2Email: "blocked-p2@test.com",
        },
        { enforcePayment: false },
      );

      expect(result).toEqual({ error: "Admin privileges required." });
    });

    it("fails override for non-admin users and does not change DB size", async () => {
      vi.mocked(requireAdmin).mockRejectedValueOnce(
        new Error("Not authorized as admin."),
      );

      const beforeTeams = await testDb
        .from("teams")
        .select("id", { count: "exact", head: true });
      const beforePlayers = await testDb
        .from("players")
        .select("id", { count: "exact", head: true });

      const result = await registerTeam(
        "competitive",
        {
          ...VALID_FORM,
          contactEmail: "unauthorized@test.com",
          player1Email: "unauthorized-p1@test.com",
          player2Email: "unauthorized-p2@test.com",
        },
        { enforcePayment: false },
      );

      expect(result).toEqual({ error: "Not authorized as admin." });

      const afterTeams = await testDb
        .from("teams")
        .select("id", { count: "exact", head: true });
      const afterPlayers = await testDb
        .from("players")
        .select("id", { count: "exact", head: true });

      expect(afterTeams.count).toBe(beforeTeams.count);
      expect(afterPlayers.count).toBe(beforePlayers.count);
    });

    it("still blocks same-bracket duplicate contact under admin override", async () => {
      const first = await registerTeam(
        "recreational",
        {
          ...VALID_FORM,
          contactEmail: "override-dup@test.com",
          player1Email: "override-dup-p1@test.com",
          player2Email: "override-dup-p2@test.com",
        },
        { enforcePayment: false },
      );
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      const second = await registerTeam(
        "recreational",
        {
          ...VALID_FORM,
          teamName: "Override Duplicate Team",
          contactEmail: "override-dup@test.com",
          player1Email: "override-dup-p3@test.com",
          player2Email: "override-dup-p4@test.com",
        },
        { enforcePayment: false },
      );
      expect(second).toEqual({
        error: "This email has already registered a team for this bracket.",
      });
    });

    it("allows same contact email across different brackets under admin override", async () => {
      const first = await registerTeam(
        "recreational",
        {
          ...VALID_FORM,
          contactEmail: "override-cross@test.com",
          player1Email: "override-cross-p1@test.com",
          player2Email: "override-cross-p2@test.com",
        },
        { enforcePayment: false },
      );
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      const second = await registerTeam(
        "competitive",
        {
          ...VALID_FORM,
          teamName: "Override Cross Bracket Team",
          contactEmail: "override-cross@test.com",
          player1Email: "override-cross-p3@test.com",
          player2Email: "override-cross-p4@test.com",
        },
        { enforcePayment: false },
      );
      expect(second).toEqual({ success: true, teamId: expect.any(String) });
    });

    it("still enforces bracket capacity when payment checks are bypassed", async () => {
      await seedTeams(brackets.recreational, 32);

      const result = await registerTeam(
        "recreational",
        {
          ...VALID_FORM,
          contactEmail: "override-full@test.com",
          player1Email: "override-full-p1@test.com",
          player2Email: "override-full-p2@test.com",
        },
        { enforcePayment: false },
      );

      expect(result).toEqual({ error: "This bracket is full." });
      expect(requireAdmin).toHaveBeenCalledTimes(1);
    });

    it("does not call requireAdmin when enforcePayment remains true", async () => {
      const result = await registerTeam("recreational", VALID_FORM, {
        enforcePayment: true,
      });

      expect(result).toEqual({ success: true, teamId: expect.any(String) });
      expect(requireAdmin).not.toHaveBeenCalled();
    });

    it("fails paid second bracket, then succeeds with admin override and updates DB counts", async () => {
      setTicketCountsByEmail({
        "player1@test.com": 1,
        "player2@test.com": 1,
      });

      // First registration uses both purchased tickets.
      const first = await registerTeam("recreational", VALID_FORM, {
        enforcePayment: true,
      });
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      const afterFirstTeams = await testDb
        .from("teams")
        .select("id", { count: "exact", head: true });
      const afterFirstPlayers = await testDb
        .from("players")
        .select("id", { count: "exact", head: true });

      expect(afterFirstTeams.count).toBe(1);
      expect(afterFirstPlayers.count).toBe(2);

      // Second registration with payment enforcement should fail due to exhausted tickets.
      const secondPaid = await registerTeam("competitive", VALID_FORM, {
        enforcePayment: true,
      });
      expect(secondPaid).toEqual({
        error: expect.stringContaining("Not enough available tickets"),
      });

      const afterFailedPaidTeams = await testDb
        .from("teams")
        .select("id", { count: "exact", head: true });
      const afterFailedPaidPlayers = await testDb
        .from("players")
        .select("id", { count: "exact", head: true });

      // Failed attempt should not create rows.
      expect(afterFailedPaidTeams.count).toBe(1);
      expect(afterFailedPaidPlayers.count).toBe(2);

      // Admin override should allow competitive registration despite ticket exhaustion.
      const secondOverride = await registerTeam(
        "competitive",
        {
          ...VALID_FORM,
          teamName: "Competitive Override Team",
          contactEmail: "contact-override@test.com",
        },
        { enforcePayment: false },
      );
      expect(secondOverride).toEqual({
        success: true,
        teamId: expect.any(String),
      });
      expect(requireAdmin).toHaveBeenCalledTimes(1);

      const finalTeams = await testDb
        .from("teams")
        .select("id", { count: "exact", head: true });
      const finalPlayers = await testDb
        .from("players")
        .select("id", { count: "exact", head: true });

      expect(finalTeams.count).toBe(2);
      expect(finalPlayers.count).toBe(4);
    });
  });

  // ── Ticket accounting edge cases ────────────────────────────────────────
  describe("ticket accounting", () => {
    it("counts only active-team usage for prior registrations", async () => {
      setTicketCountsByEmail({
        "player1@test.com": 2,
      });

      const { data: inactiveTeam } = await testDb
        .from("teams")
        .insert({
          bracket_id: brackets.recreational,
          name: "Inactive Team",
          contact_email: "inactive@test.com",
          is_active: false,
        })
        .select("id")
        .single();

      await testDb.from("players").insert({
        team_id: inactiveTeam?.id,
        name: "Inactive Player",
        email: "player1@test.com",
      });

      const result = await registerTeam("recreational", {
        ...VALID_FORM,
        player1Email: "player1@test.com",
        player2Email: "player1@test.com",
      });

      expect(result).toEqual({ success: true, teamId: expect.any(String) });
    });

    it("rejects when prior active registrations exhaust available tickets", async () => {
      setTicketCountsByEmail({
        "player1@test.com": 2,
      });

      const { data: activeTeam } = await testDb
        .from("teams")
        .insert({
          bracket_id: brackets.recreational,
          name: "Active Team",
          contact_email: "active@test.com",
          is_active: true,
        })
        .select("id")
        .single();

      await testDb.from("players").insert({
        team_id: activeTeam?.id,
        name: "Active Player",
        email: "player1@test.com",
      });

      const result = await registerTeam("competitive", {
        ...VALID_FORM,
        player1Email: "player1@test.com",
        player2Email: "player1@test.com",
      });

      expect(result).toEqual({
        error: expect.stringContaining("Not enough available tickets"),
      });
    });
  });

  // ── Stateful sequential checks ──────────────────────────────────────────
  describe("stateful sequential behavior", () => {
    it("writes exactly one team and two players on success", async () => {
      const result = await registerTeam("recreational", VALID_FORM);
      expect(result).toEqual({ success: true, teamId: expect.any(String) });

      const { count: teamCount } = await testDb
        .from("teams")
        .select("id", { count: "exact", head: true });

      const { count: playerCount } = await testDb
        .from("players")
        .select("id", { count: "exact", head: true });

      expect(teamCount).toBe(1);
      expect(playerCount).toBe(2);
    });

    it("second registration sees first registration's active players", async () => {
      setTicketCountsByEmail({
        "player1@test.com": 2,
        "player2@test.com": 1,
      });

      const first = await registerTeam("recreational", VALID_FORM);
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      const second = await registerTeam("competitive", VALID_FORM);
      expect(second).toEqual({
        error: expect.stringContaining("Not enough available tickets"),
      });
    });
  });

  // ── Multi-bracket registration ─────────────────────────────────────────
  describe("multi-bracket registration", () => {
    it("allows signing up for both brackets with 4 tickets", async () => {
      setTicketCountsByEmail({
        "player1@test.com": 2,
        "player2@test.com": 2,
      });

      const first = await registerTeam("recreational", VALID_FORM);
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      const second = await registerTeam("competitive", VALID_FORM);
      expect(second).toEqual({ success: true, teamId: expect.any(String) });
    });

    it("allows signing up for either bracket with 2 tickets", async () => {
      const result = await registerTeam("recreational", VALID_FORM);

      expect(result).toEqual({ success: true, teamId: expect.any(String) });
    });

    it("allows a shared buyer to split across brackets with different partners", async () => {
      setTicketCountsByEmail({
        "buyer@test.com": 2,
        "player2@test.com": 1,
        "player3@test.com": 1,
      });

      const competitiveForm = {
        teamName: "Comp Squad",
        contactEmail: "buyer@test.com",
        player1Name: "The Buyer",
        player1Email: "buyer@test.com",
        player2Name: "Player Two",
        player2Email: "player2@test.com",
      };

      const recreationalForm = {
        teamName: "Rec Crew",
        contactEmail: "buyer@test.com",
        player1Name: "The Buyer",
        player1Email: "buyer@test.com",
        player2Name: "Player Three",
        player2Email: "player3@test.com",
      };

      const first = await registerTeam("competitive", competitiveForm);
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      const second = await registerTeam("recreational", recreationalForm);
      expect(second).toEqual({ success: true, teamId: expect.any(String) });
    });

    it("rejects a second bracket when only 2 tickets were purchased", async () => {
      const first = await registerTeam("recreational", VALID_FORM);
      expect(first).toEqual({ success: true, teamId: expect.any(String) });

      const second = await registerTeam("competitive", VALID_FORM);

      expect(second).toEqual({
        error: expect.stringContaining("Not enough available tickets"),
      });
    });
  });
});
