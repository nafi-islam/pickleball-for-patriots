/**
 * End-to-end integration test mirroring admin UI control flow:
 * qualifying (assign → generate RR → score) → publish qualifying →
 * generate elimination bracket → verify round 1 seeding (matches `lib/bracket`) →
 * score one bracket match → publish bracket for public view.
 *
 * Run `supabase start`, then `npm run test:integration`.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-user" })),
}));

import { generateBracket, setBracketStatus } from "@/app/admin/brackets/actions";
import {
  autoAssignCourts,
  generateQualifyingMatches,
  reportQualifyingScore,
  setQualifyingStatus,
} from "@/app/admin/qualifying/actions";
import { reportMatchResult } from "@/app/admin/scoring/actions";
import { requireAdmin } from "@/lib/auth";
import {
  buildRoundOnePairings,
  getNextMatchIndex,
  getNextMatchSlot,
  getNextPowerOfTwo,
} from "@/lib/bracket";
import {
  cleanupTestData,
  seedBrackets,
  testDb,
} from "@/__tests__/helpers/integration-db";

afterAll(async () => {
  await cleanupTestData();
});

/** Matches `generateBracket`: registration order among qualifiers (`created_at` ASC). */
async function seedTeamsSequential(bracketId: string, count: number) {
  for (let i = 0; i < count; i++) {
    const { error } = await testDb.from("teams").insert({
      bracket_id: bracketId,
      name: `Flow Team ${i + 1}`,
      contact_email: `flow-team-${i + 1}@test.com`,
      is_active: true,
    });
    if (error) throw new Error(`seedTeamsSequential: ${error.message}`);
  }
}

async function completeAllQualifyingMatches(
  scoreForIndex: (i: number) => [number, number],
) {
  const { data: matches, error } = await testDb
    .from("qualifying_matches")
    .select("id")
    .order("court_id", { ascending: true })
    .order("match_index", { ascending: true });

  if (error || !matches?.length) {
    throw new Error(error?.message ?? "no qualifying_matches");
  }

  let i = 0;
  for (const m of matches) {
    const [a, b] = scoreForIndex(i++);
    expect(await reportQualifyingScore(m.id, a, b)).toEqual({ success: true });
  }
}

/** Mirrors `app/bracket/[bracketType]/page.tsx` shape for smoke checks. */
async function fetchBracketPublicSnapshot(bracketType: string) {
  const { data: bracket, error: bErr } = await testDb
    .from("brackets")
    .select("id, status")
    .eq("type", bracketType)
    .single();

  if (bErr || !bracket) throw new Error(bErr?.message ?? "bracket missing");

  const { data: matches } = await testDb
    .from("matches")
    .select(
      "id, round, index_in_round, status, score_a, score_b, team_a_id, team_b_id, winner_team_id",
    )
    .eq("bracket_id", bracket.id)
    .order("round", { ascending: true })
    .order("index_in_round", { ascending: true });

  return {
    bracketStatus: bracket.status as string,
    matches: matches ?? [],
  };
}

describe("full admin flow: qualifying → publish → bracket (integration)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const { brackets } = await seedBrackets(["recreational"]);

    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-user" } as never);

    /** One insert per row so `created_at` order matches seed order (same query as `generateBracket`). */
    await seedTeamsSequential(brackets.recreational, 8);

    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });
  });

  it("scores qualifying, publishes, generates bracket with seeded round 1, scores a match, publishes bracket", async () => {
    await completeAllQualifyingMatches((i) => [15 + i, 10 + i]);

    const { data: qualBefore } = await testDb
      .from("brackets")
      .select("qualifying_status")
      .eq("type", "recreational")
      .single();
    expect(qualBefore?.qualifying_status).toBe("DRAFT");

    expect(await setQualifyingStatus("recreational", "PUBLISHED")).toEqual({
      success: true,
    });

    const { data: qualPublished } = await testDb
      .from("brackets")
      .select("qualifying_status")
      .eq("type", "recreational")
      .single();
    expect(qualPublished?.qualifying_status).toBe("PUBLISHED");

    expect(await generateBracket("recreational")).toEqual({ success: true });

    const { data: bracketRow } = await testDb
      .from("brackets")
      .select("id, status")
      .eq("type", "recreational")
      .single();

    expect(bracketRow?.status).toBe("GENERATED");

    const { data: qualifiedTeams } = await testDb
      .from("teams")
      .select("id, name")
      .eq("bracket_id", bracketRow!.id)
      .eq("qualified", true)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    expect(qualifiedTeams?.length).toBe(4);

    const bracketSize = getNextPowerOfTwo(qualifiedTeams!.length);
    expect(bracketSize).toBe(4);

    const pairings = buildRoundOnePairings(
      qualifiedTeams!.map((t) => ({ id: t.id, name: t.name })),
      bracketSize,
    );

    const { data: roundOne } = await testDb
      .from("matches")
      .select(
        "index_in_round, team_a_id, team_b_id, winner_team_id, status, score_a, score_b",
      )
      .eq("bracket_id", bracketRow!.id)
      .eq("round", 1)
      .order("index_in_round", { ascending: true });

    expect(roundOne?.length).toBe(pairings.length);

    pairings.forEach((p, idx) => {
      const row = roundOne![idx]!;
      expect(row.team_a_id).toBe(p.teamA?.id ?? null);
      expect(row.team_b_id).toBe(p.teamB?.id ?? null);

      const byeWinner =
        p.teamA && !p.teamB
          ? p.teamA.id
          : p.teamB && !p.teamA
            ? p.teamB.id
            : null;

      expect(row.winner_team_id).toBe(byeWinner);
      expect(row.status).toBe(byeWinner ? "COMPLETED" : "PENDING");
      expect(row.score_a).toBeNull();
      expect(row.score_b).toBeNull();
    });

    const { count: totalMatches } = await testDb
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("bracket_id", bracketRow!.id);

    expect(totalMatches).toBe(bracketSize - 1);

    const { data: pendingHeadToHead } = await testDb
      .from("matches")
      .select("id")
      .eq("bracket_id", bracketRow!.id)
      .eq("round", 1)
      .not("team_a_id", "is", null)
      .not("team_b_id", "is", null)
      .eq("status", "PENDING")
      .limit(1)
      .maybeSingle();

    expect(pendingHeadToHead?.id).toBeDefined();

    expect(
      await reportMatchResult({
        matchId: pendingHeadToHead!.id,
        scoreA: 15,
        scoreB: 12,
      }),
    ).toEqual({ success: true });

    const { data: scoredMatch } = await testDb
      .from("matches")
      .select(
        "winner_team_id, score_a, score_b, status, round, index_in_round, bracket_id",
      )
      .eq("id", pendingHeadToHead!.id)
      .single();

    expect(scoredMatch?.status).toBe("COMPLETED");
    expect(scoredMatch?.score_a).toBe(15);
    expect(scoredMatch?.score_b).toBe(12);

    const winnerId = scoredMatch!.winner_team_id!;
    const nextRound = scoredMatch!.round + 1;
    const nextIdx = getNextMatchIndex(scoredMatch!.index_in_round);
    const slot = getNextMatchSlot(scoredMatch!.index_in_round);

    const { data: nextSlotRow } = await testDb
      .from("matches")
      .select("team_a_id, team_b_id")
      .eq("bracket_id", scoredMatch!.bracket_id)
      .eq("round", nextRound)
      .eq("index_in_round", nextIdx)
      .single();

    expect(nextSlotRow?.[slot]).toBe(winnerId);

    expect(await setBracketStatus("recreational", "PUBLISHED")).toEqual({
      success: true,
    });

    const { data: bracketFinal } = await testDb
      .from("brackets")
      .select("status, qualifying_status")
      .eq("type", "recreational")
      .single();

    expect(bracketFinal?.status).toBe("PUBLISHED");
    expect(bracketFinal?.qualifying_status).toBe("PUBLISHED");

    const pubSnap = await fetchBracketPublicSnapshot("recreational");
    expect(pubSnap.bracketStatus).toBe("PUBLISHED");

    const finished = pubSnap.matches.find((m) => m.id === pendingHeadToHead!.id);
    expect(finished?.score_a).toBe(15);
    expect(finished?.score_b).toBe(12);
  });
});
