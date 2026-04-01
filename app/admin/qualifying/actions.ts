"use server";

import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { buildRoundRobinMatches, computeStats, rankTeams } from "@/lib/qualifying";
import { revalidatePath } from "next/cache";

type BracketType = "recreational" | "competitive";

async function getBracketByType(type: BracketType) {
  const { data: bracket, error } = await supabase
    .from("brackets")
    .select("id, type")
    .eq("type", type)
    .single();

  if (error || !bracket) {
    throw new Error("Bracket not found.");
  }

  return bracket;
}

export async function autoAssignCourts(bracketType: BracketType) {
  await requireAdmin();

  const bracket = await getBracketByType(bracketType);

  const { count: existingCourts } = await supabase
    .from("qualifying_courts")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id);

  if ((existingCourts ?? 0) > 0) {
    throw new Error("Courts already exist for this bracket.");
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, created_at")
    .eq("bracket_id", bracket.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (teamsError || !teams) {
    throw new Error("Failed to load teams.");
  }

  if (teams.length < 4) {
    throw new Error("At least 4 active teams are required to assign courts.");
  }

  if (teams.length % 4 !== 0) {
    throw new Error("Team count must be a multiple of 4 to assign courts.");
  }

  const courtCount = teams.length / 4;

  const { data: courts, error: courtsError } = await supabase
    .from("qualifying_courts")
    .insert(
      Array.from({ length: courtCount }, (_, idx) => ({
        bracket_id: bracket.id,
        court_number: idx + 1,
      })),
    )
    .select("id, court_number")
    .order("court_number", { ascending: true });

  if (courtsError || !courts) {
    throw new Error("Failed to create courts.");
  }

  const assignments = courts.flatMap((court, courtIdx) => {
    const baseIndex = courtIdx * 4;
    return teams.slice(baseIndex, baseIndex + 4).map((team, idx) => ({
      court_id: court.id,
      team_id: team.id,
      position: idx + 1,
    }));
  });

  const { error: assignmentsError } = await supabase
    .from("qualifying_assignments")
    .insert(assignments);

  if (assignmentsError) {
    throw new Error("Failed to assign teams to courts.");
  }

  const statRows = assignments.map((assignment) => ({
    team_id: assignment.team_id,
    court_id: assignment.court_id,
  }));

  const { error: statsError } = await supabase
    .from("qualifying_team_stats")
    .upsert(statRows, { onConflict: "team_id" });

  if (statsError) {
    throw new Error("Failed to initialize team stats.");
  }

  await supabase
    .from("teams")
    .update({ qualified: false })
    .eq("bracket_id", bracket.id);

  revalidatePath("/admin/qualifying");
  revalidatePath("/admin/brackets");
}

export async function generateQualifyingMatches(bracketType: BracketType) {
  await requireAdmin();

  const bracket = await getBracketByType(bracketType);

  const { data: courts, error: courtsError } = await supabase
    .from("qualifying_courts")
    .select("id, court_number")
    .eq("bracket_id", bracket.id)
    .order("court_number", { ascending: true });

  if (courtsError || !courts || courts.length === 0) {
    throw new Error("No courts found. Assign teams to courts first.");
  }

  const { count: existingMatches } = await supabase
    .from("qualifying_matches")
    .select("id", { count: "exact", head: true })
    .in(
      "court_id",
      courts.map((court) => court.id),
    );

  if ((existingMatches ?? 0) > 0) {
    throw new Error("Qualifying matches already exist.");
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("qualifying_assignments")
    .select("court_id, position, team:team_id ( id, name )")
    .in(
      "court_id",
      courts.map((court) => court.id),
    );

  if (assignmentsError || !assignments) {
    throw new Error("Failed to load court assignments.");
  }

  const matches = courts.flatMap((court) => {
    const courtTeams = assignments
      .filter((assignment) => assignment.court_id === court.id)
      .sort((a, b) => a.position - b.position)
      .map((assignment) => assignment.team as { id: string; name: string });

    if (courtTeams.length !== 4) {
      throw new Error("Each court must have exactly 4 teams.");
    }

    return buildRoundRobinMatches(courtTeams).map((match) => ({
      court_id: court.id,
      match_index: match.match_index,
      team_a_id: match.team_a_id,
      team_b_id: match.team_b_id,
    }));
  });

  const { error: insertError } = await supabase
    .from("qualifying_matches")
    .insert(matches);

  if (insertError) {
    throw new Error("Failed to generate qualifying matches.");
  }

  revalidatePath("/admin/qualifying");
  revalidatePath(`/qualifying/${bracketType}`);
}

async function recomputeCourtStats(courtId: string) {
  const { data: assignments, error: assignmentsError } = await supabase
    .from("qualifying_assignments")
    .select("team:team_id ( id, name )")
    .eq("court_id", courtId);

  if (assignmentsError || !assignments) {
    throw new Error("Failed to load court assignments.");
  }

  const teams = assignments.map((assignment) => assignment.team as { id: string; name: string });

  const { data: matches, error: matchesError } = await supabase
    .from("qualifying_matches")
    .select("team_a_id, team_b_id, score_a, score_b, status")
    .eq("court_id", courtId);

  if (matchesError || !matches) {
    throw new Error("Failed to load court matches.");
  }

  const stats = computeStats(teams, matches);

  const { error: upsertError } = await supabase
    .from("qualifying_team_stats")
    .upsert(
      stats.map((stat) => ({
        team_id: stat.team_id,
        court_id: courtId,
        wins: stat.wins,
        losses: stat.losses,
        points_for: stat.points_for,
        points_against: stat.points_against,
        differential: stat.differential,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "team_id" },
    );

  if (upsertError) {
    throw new Error("Failed to update team stats.");
  }
}

export async function reportQualifyingScore(
  matchId: string,
  scoreA: number,
  scoreB: number,
) {
  await requireAdmin();

  if (scoreA === scoreB) {
    throw new Error("Qualifying matches cannot end in a tie.");
  }

  const { data: match, error: matchError } = await supabase
    .from("qualifying_matches")
    .select("id, court_id, team_a_id, team_b_id")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new Error("Match not found.");
  }

  const winnerTeamId = scoreA > scoreB ? match.team_a_id : match.team_b_id;

  const { error: updateError } = await supabase
    .from("qualifying_matches")
    .update({
      score_a: scoreA,
      score_b: scoreB,
      winner_team_id: winnerTeamId,
      status: "COMPLETED",
    })
    .eq("id", matchId);

  if (updateError) {
    throw new Error("Failed to update match.");
  }

  await recomputeCourtStats(match.court_id);

  revalidatePath("/admin/qualifying");
  revalidatePath("/admin/brackets");
  revalidatePath("/qualifying/recreational");
  revalidatePath("/qualifying/competitive");
}

export async function autoSelectQualifiers(bracketType: BracketType) {
  await requireAdmin();

  const bracket = await getBracketByType(bracketType);

  const { data: courts, error: courtsError } = await supabase
    .from("qualifying_courts")
    .select("id, court_number")
    .eq("bracket_id", bracket.id);

  if (courtsError || !courts || courts.length === 0) {
    throw new Error("No courts found for this bracket.");
  }

  for (const court of courts) {
    const { data: stats, error: statsError } = await supabase
      .from("qualifying_team_stats")
      .select("team_id, wins, losses, points_for, points_against, differential")
      .eq("court_id", court.id);

    if (statsError || !stats) {
      throw new Error("Failed to load court stats.");
    }

    const ranked = rankTeams(stats);
    const topTwo = ranked.slice(0, 2).map((entry) => entry.team_id);

    const { data: assignments } = await supabase
      .from("qualifying_assignments")
      .select("team_id")
      .eq("court_id", court.id);

    const courtTeams = assignments?.map((assignment) => assignment.team_id) ?? [];

    await supabase
      .from("teams")
      .update({ qualified: true })
      .in("id", topTwo);

    const nonQualified = courtTeams.filter((teamId) => !topTwo.includes(teamId));
    if (nonQualified.length > 0) {
      await supabase
        .from("teams")
        .update({ qualified: false })
        .in("id", nonQualified);
    }
  }

  revalidatePath("/admin/qualifying");
  revalidatePath("/admin/brackets");
}

export async function setCourtQualifiers(courtId: string, teamIds: string[]) {
  await requireAdmin();

  if (teamIds.length !== 2) {
    throw new Error("Select exactly two teams to advance.");
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("qualifying_assignments")
    .select("team_id")
    .eq("court_id", courtId);

  if (assignmentsError || !assignments) {
    throw new Error("Failed to load court assignments.");
  }

  const courtTeamIds = assignments.map((assignment) => assignment.team_id);

  for (const teamId of teamIds) {
    if (!courtTeamIds.includes(teamId)) {
      throw new Error("Selected teams must belong to this court.");
    }
  }

  await supabase
    .from("teams")
    .update({ qualified: true })
    .in("id", teamIds);

  const nonQualified = courtTeamIds.filter((id) => !teamIds.includes(id));
  if (nonQualified.length > 0) {
    await supabase
      .from("teams")
      .update({ qualified: false })
      .in("id", nonQualified);
  }

  revalidatePath("/admin/qualifying");
}

export async function resetQualifying(bracketType: BracketType) {
  await requireAdmin();

  const bracket = await getBracketByType(bracketType);

  const { data: courts } = await supabase
    .from("qualifying_courts")
    .select("id")
    .eq("bracket_id", bracket.id);

  const courtIds = (courts ?? []).map((court) => court.id);

  if (courtIds.length > 0) {
    await supabase
      .from("qualifying_matches")
      .delete()
      .in("court_id", courtIds);

    await supabase
      .from("qualifying_team_stats")
      .delete()
      .in("court_id", courtIds);

    await supabase
      .from("qualifying_assignments")
      .delete()
      .in("court_id", courtIds);

    await supabase
      .from("qualifying_courts")
      .delete()
      .in("id", courtIds);
  }

  await supabase
    .from("teams")
    .update({ qualified: false })
    .eq("bracket_id", bracket.id);

  revalidatePath("/admin/qualifying");
}
