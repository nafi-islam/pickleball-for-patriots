/**
 * Integration tests for qualifying score reporting.
 *
 * Hits real local Supabase (same pattern as registerTeam integration tests).
 * Run `supabase start`, then `npm run test:integration`.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-user" })),
}));

import {
  autoAssignCourts,
  generateQualifyingMatches,
  reportQualifyingScore,
  setQualifyingStatus,
} from "@/app/admin/qualifying/actions";
import { requireAdmin } from "@/lib/auth";
import {
  cleanupTestData,
  seedBrackets,
  seedTeams,
  testDb,
} from "@/__tests__/helpers/integration-db";
import {
  computeStats,
  rankTeams,
  type QualifyingStat,
} from "@/lib/qualifying";

type MatchRow = {
  id: string;
  court_id: string;
  match_index: number;
  status: string;
  score_a: number | null;
  score_b: number | null;
};

type StatRow = {
  team_id: string;
  court_id: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  differential: number;
};

async function fetchQualifyingPublicSnapshot(bracketType: string): Promise<{
  qualifying_status: string;
  matches: MatchRow[];
  stats: StatRow[];
}> {
  const { data: bracket, error: bErr } = await testDb
    .from("brackets")
    .select("id, qualifying_status")
    .eq("type", bracketType)
    .single();

  if (bErr || !bracket) throw new Error(bErr?.message ?? "bracket not found");

  const { data: courts } = await testDb
    .from("qualifying_courts")
    .select("id")
    .eq("bracket_id", bracket.id);

  const courtIds = (courts ?? []).map((c) => c.id);
  if (courtIds.length === 0) {
    return {
      qualifying_status: bracket.qualifying_status ?? "DRAFT",
      matches: [],
      stats: [],
    };
  }

  const { data: matches, error: mErr } = await testDb
    .from("qualifying_matches")
    .select("id, court_id, match_index, status, score_a, score_b")
    .in("court_id", courtIds)
    .order("court_id", { ascending: true })
    .order("match_index", { ascending: true });

  if (mErr) throw new Error(mErr.message);

  const { data: stats, error: sErr } = await testDb
    .from("qualifying_team_stats")
    .select(
      "team_id, court_id, wins, losses, points_for, points_against, differential",
    )
    .in("court_id", courtIds);

  if (sErr) throw new Error(sErr.message);

  return {
    qualifying_status: bracket.qualifying_status ?? "DRAFT",
    matches: (matches ?? []) as MatchRow[],
    stats: sortStatsForCompare((stats ?? []) as StatRow[]),
  };
}

function sortStatsForCompare(stats: StatRow[]): StatRow[] {
  return [...stats].sort((a, b) => {
    const c = a.court_id.localeCompare(b.court_id);
    if (c !== 0) return c;
    return a.team_id.localeCompare(b.team_id);
  });
}

function sortMatchesForCompare(matches: MatchRow[]): MatchRow[] {
  return [...matches].sort((a, b) => {
    const c = a.court_id.localeCompare(b.court_id);
    if (c !== 0) return c;
    return a.match_index - b.match_index;
  });
}

/** Recomputes stats from match rows (source of truth) and asserts DB stats match. */
async function assertCourtStatsMatchComputedFromMatches(courtId: string) {
  const { data: assignments } = await testDb
    .from("qualifying_assignments")
    .select("team_id")
    .eq("court_id", courtId)
    .order("position", { ascending: true });

  const assignmentIds = assignments?.map((a) => a.team_id) ?? [];
  const { data: teams } = await testDb
    .from("teams")
    .select("id, name")
    .in("id", assignmentIds);

  const teamSeeds = (teams ?? []).map((t) => ({ id: t.id, name: t.name }));

  const { data: matchRows } = await testDb
    .from("qualifying_matches")
    .select("team_a_id, team_b_id, score_a, score_b, status")
    .eq("court_id", courtId);

  const expected = computeStats(teamSeeds, matchRows ?? []);

  const { data: stored } = await testDb
    .from("qualifying_team_stats")
    .select(
      "team_id, wins, losses, points_for, points_against, differential",
    )
    .eq("court_id", courtId);

  expect(stored?.length).toBe(expected.length);

  const byTeam = new Map((stored ?? []).map((s) => [s.team_id, s]));
  for (const e of expected) {
    expect(byTeam.get(e.team_id)).toMatchObject({
      wins: e.wins,
      losses: e.losses,
      points_for: e.points_for,
      points_against: e.points_against,
      differential: e.differential,
    });
  }
}

function topTwoTeamIdsFromRankedStats(stats: QualifyingStat[]): [string, string] {
  const ranked = rankTeams(stats);
  return [ranked[0]!.team_id, ranked[1]!.team_id];
}

/** `teams.qualified` should match top two on this court per `rankTeams`. */
async function assertCourtQualifiedMatchesRanking(courtId: string) {
  const { data: stats } = await testDb
    .from("qualifying_team_stats")
    .select(
      "team_id, wins, losses, points_for, points_against, differential",
    )
    .eq("court_id", courtId);

  const top2 = new Set(
    topTwoTeamIdsFromRankedStats((stats ?? []) as QualifyingStat[]),
  );

  const { data: assignments } = await testDb
    .from("qualifying_assignments")
    .select("team_id")
    .eq("court_id", courtId);

  const courtTeamIds = assignments?.map((a) => a.team_id) ?? [];

  const { data: teams } = await testDb
    .from("teams")
    .select("id, qualified")
    .in("id", courtTeamIds);

  for (const t of teams ?? []) {
    expect(t.qualified).toBe(top2.has(t.id));
  }
}

afterAll(async () => {
  await cleanupTestData();
});

async function pickTwoMatchesFromDifferentCourts(): Promise<[string, string]> {
  const { data: matches, error } = await testDb
    .from("qualifying_matches")
    .select("id, court_id")
    .order("court_id", { ascending: true })
    .order("match_index", { ascending: true });

  if (error || !matches?.length) {
    throw new Error(error?.message ?? "no qualifying_matches");
  }

  const firstCourtId = matches[0].court_id;
  const idOnFirstCourt = matches[0].id;
  const other = matches.find((m) => m.court_id !== firstCourtId);
  if (!other) {
    throw new Error("expected at least two courts with matches");
  }

  return [idOnFirstCourt, other.id];
}

describe("reportQualifyingScore (integration)", () => {
  let recreationalBracketId: string;

  beforeEach(async () => {
    await cleanupTestData();
    const { brackets } = await seedBrackets(["recreational"]);
    recreationalBracketId = brackets.recreational;

    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-user" } as never);

    /** Eight teams → two courts → parallel score updates avoid one court’s stats race. */
    await seedTeams(recreationalBracketId, 8);

    const assign = await autoAssignCourts("recreational");
    expect(assign).toEqual({ success: true });

    const gen = await generateQualifyingMatches("recreational");
    expect(gen).toEqual({ success: true });
  });

  it("updates two matches on different courts in parallel", async () => {
    const [matchIdA, matchIdB] = await pickTwoMatchesFromDifferentCourts();

    const [rA, rB] = await Promise.all([
      reportQualifyingScore(matchIdA, 15, 13),
      reportQualifyingScore(matchIdB, 21, 19),
    ]);

    expect(rA).toEqual({ success: true });
    expect(rB).toEqual({ success: true });

    const { data: rows, error } = await testDb
      .from("qualifying_matches")
      .select("id, score_a, score_b, status")
      .in("id", [matchIdA, matchIdB]);

    expect(error).toBeNull();
    expect(rows).toHaveLength(2);

    const rowA = rows!.find((r) => r.id === matchIdA);
    const rowB = rows!.find((r) => r.id === matchIdB);
    expect(rowA).toMatchObject({
      score_a: 15,
      score_b: 13,
      status: "COMPLETED",
    });
    expect(rowB).toMatchObject({
      score_a: 21,
      score_b: 19,
      status: "COMPLETED",
    });
  });

  it("rejects tied scores", async () => {
    const { data: m, error } = await testDb
      .from("qualifying_matches")
      .select("id")
      .limit(1)
      .maybeSingle();

    expect(error).toBeNull();
    expect(m?.id).toBeDefined();

    const result = await reportQualifyingScore(m!.id, 11, 11);
    expect(result).toEqual({
      error: "Qualifying matches cannot end in a tie.",
    });
  });

  it("rejects non-integer scores", async () => {
    const { data: m } = await testDb
      .from("qualifying_matches")
      .select("id")
      .limit(1)
      .maybeSingle();

    expect(m?.id).toBeDefined();

    const result = await reportQualifyingScore(
      m!.id,
      11.5 as unknown as number,
      9,
    );
    expect(result).toEqual({
      error: "Scores must be whole numbers.",
    });
  });
});

/**
 * Two concurrent reports on the **same** court can interleave recomputes; this
 * assertion compares stored stats to `computeStats` from match rows. If it
 * fails, rerun — outcome can be timing-dependent.
 */
describe("same-court concurrent score reporting (integration)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const { brackets } = await seedBrackets(["recreational"]);

    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-user" } as never);

    await seedTeams(brackets.recreational, 4);

    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });
  });

  it("stored stats match computed stats after parallel saves on one court", async () => {
    const { data: courts } = await testDb
      .from("qualifying_courts")
      .select("id")
      .order("court_number", { ascending: true })
      .limit(1);

    const courtId = courts![0]!.id;

    const { data: matches } = await testDb
      .from("qualifying_matches")
      .select("id")
      .eq("court_id", courtId)
      .order("match_index", { ascending: true });

    expect(matches).toHaveLength(6);

    for (let i = 0; i < 4; i++) {
      expect(await reportQualifyingScore(matches![i]!.id, 11 + i, 8)).toEqual({
        success: true,
      });
    }

    await Promise.all([
      reportQualifyingScore(matches![4]!.id, 15, 12),
      reportQualifyingScore(matches![5]!.id, 14, 10),
    ]);

    await assertCourtStatsMatchComputedFromMatches(courtId);
  });
});

describe("mixed court sizes (integration)", () => {
  it("10 teams → assignment counts 4+4+2 and match counts 6+6+3", async () => {
    await cleanupTestData();
    const { brackets } = await seedBrackets(["recreational"]);

    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-user" } as never);

    await seedTeams(brackets.recreational, 10);

    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });

    const { data: bracket } = await testDb
      .from("brackets")
      .select("id")
      .eq("type", "recreational")
      .single();

    const { data: courts } = await testDb
      .from("qualifying_courts")
      .select("id, court_number")
      .eq("bracket_id", bracket!.id)
      .order("court_number", { ascending: true });

    expect(courts).toHaveLength(3);

    const perCourt = await Promise.all(
      (courts ?? []).map(async (c) => {
        const { count: teamCount } = await testDb
          .from("qualifying_assignments")
          .select("id", { count: "exact", head: true })
          .eq("court_id", c.id);

        const { count: matchCount } = await testDb
          .from("qualifying_matches")
          .select("id", { count: "exact", head: true })
          .eq("court_id", c.id);

        return {
          teamCount: teamCount ?? 0,
          matchCount: matchCount ?? 0,
        };
      }),
    );

    const teamCounts = perCourt.map((r) => r.teamCount).sort((a, b) => b - a);
    const matchCounts = perCourt.map((r) => r.matchCount).sort((a, b) => a - b);

    expect(teamCounts).toEqual([4, 4, 2]);
    expect(matchCounts).toEqual([3, 6, 6]);
  });

  it("11 teams → assignment counts 4+4+3 and six matches per court", async () => {
    await cleanupTestData();
    const { brackets } = await seedBrackets(["recreational"]);

    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-user" } as never);

    await seedTeams(brackets.recreational, 11);

    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });

    const { data: bracket } = await testDb
      .from("brackets")
      .select("id")
      .eq("type", "recreational")
      .single();

    const { data: courts } = await testDb
      .from("qualifying_courts")
      .select("id")
      .eq("bracket_id", bracket!.id)
      .order("court_number", { ascending: true });

    expect(courts).toHaveLength(3);

    const teamCounts: number[] = [];
    const matchCounts: number[] = [];

    for (const c of courts ?? []) {
      const { count: tc } = await testDb
        .from("qualifying_assignments")
        .select("id", { count: "exact", head: true })
        .eq("court_id", c.id);

      const { count: mc } = await testDb
        .from("qualifying_matches")
        .select("id", { count: "exact", head: true })
        .eq("court_id", c.id);

      teamCounts.push(tc ?? 0);
      matchCounts.push(mc ?? 0);
    }

    expect(teamCounts.sort((a, b) => b - a)).toEqual([4, 4, 3]);
    expect(matchCounts.every((n) => n === 6)).toBe(true);
  });
});

/**
 * Twelve teams → three courts → round-robin per court (mirrors public page data).
 * PUBLISH only flips qualifying_status; match rows stay the source of truth.
 */
describe("qualifying publish + live score updates (integration)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const { brackets } = await seedBrackets(["recreational"]);

    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-user" } as never);

    await seedTeams(brackets.recreational, 12);

    expect(await autoAssignCourts("recreational")).toEqual({ success: true });
    expect(await generateQualifyingMatches("recreational")).toEqual({
      success: true,
    });
  });

  async function completeAllQualifyingMatches(
    scoreForIndex: (i: number) => [number, number],
  ) {
    const { data: matches, error } = await testDb
      .from("qualifying_matches")
      .select("id")
      .order("court_id", { ascending: true })
      .order("match_index", { ascending: true });

    if (error || !matches?.length) {
      throw new Error(error?.message ?? "no matches to complete");
    }

    let i = 0;
    for (const m of matches) {
      const [a, b] = scoreForIndex(i++);
      expect(await reportQualifyingScore(m.id, a, b)).toEqual({
        success: true,
      });
    }
  }

  it("matches public-view data after publish and keeps PUBLISHED when scores change", async () => {
    /** Distinct winners per match index; spacing avoids ties. */
    await completeAllQualifyingMatches((i) => [15 + i, 10 + i]);

    const draftSnap = await fetchQualifyingPublicSnapshot("recreational");
    expect(draftSnap.qualifying_status).toBe("DRAFT");
    expect(draftSnap.matches.every((m) => m.status === "COMPLETED")).toBe(true);
    expect(draftSnap.matches).toHaveLength(18);

    expect(await setQualifyingStatus("recreational", "PUBLISHED")).toEqual({
      success: true,
    });

    const publishedSnap = await fetchQualifyingPublicSnapshot("recreational");
    expect(publishedSnap.qualifying_status).toBe("PUBLISHED");
    expect(sortMatchesForCompare(publishedSnap.matches)).toEqual(
      sortMatchesForCompare(draftSnap.matches),
    );
    expect(publishedSnap.stats).toEqual(draftSnap.stats);

    const courtForQualifierAssertions =
      publishedSnap.matches[3]!.court_id;

    await assertCourtQualifiedMatchesRanking(courtForQualifierAssertions);

    const [firstId, fourthId] = [
      publishedSnap.matches[0]!.id,
      publishedSnap.matches[3]!.id,
    ];

    expect(await reportQualifyingScore(firstId, 22, 20)).toEqual({
      success: true,
    });
    expect(await reportQualifyingScore(fourthId, 8, 11)).toEqual({
      success: true,
    });

    const afterEdit = await fetchQualifyingPublicSnapshot("recreational");
    expect(afterEdit.qualifying_status).toBe("PUBLISHED");

    expect(afterEdit.matches.find((m) => m.id === firstId)).toMatchObject({
      score_a: 22,
      score_b: 20,
      status: "COMPLETED",
    });
    expect(afterEdit.matches.find((m) => m.id === fourthId)).toMatchObject({
      score_a: 8,
      score_b: 11,
      status: "COMPLETED",
    });

    expect(sortMatchesForCompare(afterEdit.matches)).not.toEqual(
      sortMatchesForCompare(publishedSnap.matches),
    );
    expect(afterEdit.stats).not.toEqual(publishedSnap.stats);

    await assertCourtQualifiedMatchesRanking(courtForQualifierAssertions);
  });
});
