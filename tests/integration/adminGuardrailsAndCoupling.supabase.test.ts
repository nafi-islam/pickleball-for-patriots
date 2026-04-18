/**
 * Stress tests for admin actions: duplicate ops, prerequisites, resets, and
 * **state coupling** between qualifying and elimination bracket.
 *
 * Failures here indicate product bugs or sharp edges worth fixing.
 *
 * Run `npm run test:integration`.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-user" })),
}));

import {
  generateBracket,
  resetBracket,
  setBracketStatus,
} from "@/app/admin/brackets/actions";
import {
  autoAssignCourts,
  generateQualifyingMatches,
  reportQualifyingScore,
  resetQualifying,
  setQualifyingStatus,
} from "@/app/admin/qualifying/actions";
import { reportMatchResult, setMatchCourt } from "@/app/admin/scoring/actions";
import { requireAdmin } from "@/lib/auth";
import {
  cleanupTestData,
  seedBrackets,
  seedTeams,
  testDb,
} from "@/__tests__/helpers/integration-db";

afterAll(async () => {
  await cleanupTestData();
});

async function seedTeamsSequential(bracketId: string, count: number) {
  for (let i = 0; i < count; i++) {
    const { error } = await testDb.from("teams").insert({
      bracket_id: bracketId,
      name: `Guard Team ${i + 1}`,
      contact_email: `guard-team-${i + 1}@test.com`,
      is_active: true,
    });
    if (error) throw new Error(error.message);
  }
}

async function scoreEveryQualifyingMatch() {
  const { data: matches } = await testDb
    .from("qualifying_matches")
    .select("id")
    .order("court_id", { ascending: true })
    .order("match_index", { ascending: true });

  let i = 0;
  for (const m of matches ?? []) {
    expect(await reportQualifyingScore(m.id, 14 + i, 11 + i)).toEqual({
      success: true,
    });
    i += 1;
  }
}

describe("admin guardrails (integration)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-user" } as never);
  });

  it("rejects a second autoAssignCourts for the same bracket", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeams(brackets.recreational, 4);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });

    expect(await autoAssignCourts("recreational")).toEqual({
      error: "Courts already exist for this bracket.",
    });
  });

  it("rejects a second generateQualifyingMatches", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeams(brackets.recreational, 4);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });

    expect(await generateQualifyingMatches("recreational")).toEqual({
      error: "Qualifying matches already exist.",
    });
  });

  it("rejects generateBracket when qualifying produced no qualified teams yet", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeams(brackets.recreational, 8);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });

    const gen = await generateBracket("recreational");
    expect(gen).toEqual({
      error:
        "Qualifying is not complete. Select advancing teams before generating the bracket.",
    });
  });

  it("rejects a second generateBracket", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeamsSequential(brackets.recreational, 8);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });
    await scoreEveryQualifyingMatch();

    expect(await generateBracket("recreational")).toEqual({ success: true });
    expect(await generateBracket("recreational")).toEqual({
      error: "Bracket has already been generated.",
    });
  });

  it("resetBracket clears elimination matches and returns bracket to DRAFT", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeamsSequential(brackets.recreational, 8);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });
    await scoreEveryQualifyingMatch();

    expect(await generateBracket("recreational")).toEqual({ success: true });

    const { data: bracket } = await testDb
      .from("brackets")
      .select("id")
      .eq("type", "recreational")
      .single();

    const { count: before } = await testDb
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("bracket_id", bracket!.id);

    expect((before ?? 0) > 0).toBe(true);

    expect(await resetBracket("recreational")).toEqual({ success: true });

    const { count: after } = await testDb
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("bracket_id", bracket!.id);

    expect(after ?? 0).toBe(0);

    const { data: row } = await testDb
      .from("brackets")
      .select("status")
      .eq("id", bracket!.id)
      .single();

    expect(row?.status).toBe("DRAFT");

    expect(await generateBracket("recreational")).toEqual({ success: true });
  });

  it("reportMatchResult rejects scoring a bye / incomplete pairing", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeamsSequential(brackets.recreational, 12);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });
    await scoreEveryQualifyingMatch();

    expect(await generateBracket("recreational")).toEqual({ success: true });

    const { data: bracket } = await testDb
      .from("brackets")
      .select("id")
      .eq("type", "recreational")
      .single();

    const { data: byeRow } = await testDb
      .from("matches")
      .select("id")
      .eq("bracket_id", bracket!.id)
      .eq("round", 1)
      .or("team_a_id.is.null,team_b_id.is.null")
      .limit(1)
      .maybeSingle();

    expect(byeRow?.id).toBeDefined();

    const res = await reportMatchResult({
      matchId: byeRow!.id,
      scoreA: 11,
      scoreB: 9,
    });
    expect(res).toEqual({
      error: "This match is not ready for scoring.",
    });
  });

  it("reportMatchResult rejects double scoring the same match", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeamsSequential(brackets.recreational, 8);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });
    await scoreEveryQualifyingMatch();
    expect(await generateBracket("recreational")).toEqual({ success: true });

    const { data: br } = await testDb
      .from("brackets")
      .select("id")
      .eq("type", "recreational")
      .single();

    const { data: playable } = await testDb
      .from("matches")
      .select("id")
      .eq("bracket_id", br!.id)
      .eq("round", 1)
      .not("team_a_id", "is", null)
      .not("team_b_id", "is", null)
      .limit(1)
      .maybeSingle();

    expect(await reportMatchResult({
      matchId: playable!.id,
      scoreA: 15,
      scoreB: 12,
    })).toEqual({ success: true });

    expect(await reportMatchResult({
      matchId: playable!.id,
      scoreA: 16,
      scoreB: 10,
    })).toEqual({
      error: "This match has already been completed.",
    });
  });

  it("setMatchCourt rejects invalid court numbers", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeamsSequential(brackets.recreational, 8);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });
    await scoreEveryQualifyingMatch();
    expect(await generateBracket("recreational")).toEqual({ success: true });

    const { data: brRow } = await testDb
      .from("brackets")
      .select("id")
      .eq("type", "recreational")
      .single();

    const { data: m } = await testDb
      .from("matches")
      .select("id")
      .eq("bracket_id", brRow!.id)
      .limit(1)
      .maybeSingle();

    expect(
      await setMatchCourt({ matchId: m!.id, court: 99 }),
    ).toEqual({
      error: "Court must be between 1 and 8.",
    });
  });
});

/**
 * Documents coupling / inconsistent state the UI can surface if admins reset
 * one stage without the other.
 */
describe("qualifying ↔ bracket state coupling (integration)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-user" } as never);
  });

  it("resetQualifying does not delete elimination matches or bracket status", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeamsSequential(brackets.recreational, 8);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });
    await scoreEveryQualifyingMatch();
    expect(await generateBracket("recreational")).toEqual({ success: true });

    const { data: bracket } = await testDb
      .from("brackets")
      .select("id, status")
      .eq("type", "recreational")
      .single();

    const { count: matchCountBefore } = await testDb
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("bracket_id", bracket!.id);

    expect(await resetQualifying("recreational")).toEqual({ success: true });

    const { count: matchCountAfter } = await testDb
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("bracket_id", bracket!.id);

    expect(matchCountAfter).toBe(matchCountBefore);

    const { data: bracketAfter } = await testDb
      .from("brackets")
      .select("status")
      .eq("id", bracket!.id)
      .single();

    expect(bracketAfter?.status).toBe("GENERATED");

    const { count: courtsAfter } = await testDb
      .from("qualifying_courts")
      .select("id", { count: "exact", head: true })
      .eq("bracket_id", bracket!.id);

    expect(courtsAfter ?? 0).toBe(0);
  });

  it("resetQualifying leaves qualifying_status PUBLISHED if it was published", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeams(brackets.recreational, 4);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });

    expect(await setQualifyingStatus("recreational", "PUBLISHED")).toEqual({
      success: true,
    });

    expect(await resetQualifying("recreational")).toEqual({ success: true });

    const { data: row } = await testDb
      .from("brackets")
      .select("qualifying_status")
      .eq("type", "recreational")
      .single();

    expect(row?.qualifying_status).toBe("PUBLISHED");
  });

  it("allows setBracketStatus PUBLISHED even when elimination bracket has no matches yet", async () => {
    await seedBrackets(["recreational"]);

    expect(await setBracketStatus("recreational", "PUBLISHED")).toEqual({
      success: true,
    });

    const { data: bracket } = await testDb
      .from("brackets")
      .select("id, status")
      .eq("type", "recreational")
      .single();

    expect(bracket?.status).toBe("PUBLISHED");

    const { count } = await testDb
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("bracket_id", bracket!.id);

    expect(count ?? 0).toBe(0);
  });

  it("resetBracket does not clear qualifying_status after qualifying was published", async () => {
    const { brackets } = await seedBrackets(["recreational"]);
    await seedTeamsSequential(brackets.recreational, 8);
    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });
    await scoreEveryQualifyingMatch();

    expect(await setQualifyingStatus("recreational", "PUBLISHED")).toEqual({
      success: true,
    });
    expect(await generateBracket("recreational")).toEqual({ success: true });
    expect(await resetBracket("recreational")).toEqual({ success: true });

    const { data: row } = await testDb
      .from("brackets")
      .select("status, qualifying_status")
      .eq("type", "recreational")
      .single();

    expect(row?.status).toBe("DRAFT");
    expect(row?.qualifying_status).toBe("PUBLISHED");
  });
});
