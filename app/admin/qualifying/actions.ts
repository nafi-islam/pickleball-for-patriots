"use server";

import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { buildRoundRobinMatches, computeStats, rankTeams } from "@/lib/qualifying";
import { revalidatePath } from "next/cache";

type BracketType = "recreational" | "competitive";
type QualifyingStatus = "DRAFT" | "PUBLISHED";

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

export async function autoAssignCourts(
  bracketType: BracketType,
): Promise<{ success: true } | { error: string }> {
  try {
  // 1) Admin gate.
  await requireAdmin();

  // 2) Load bracket.
  const bracket = await getBracketByType(bracketType);

  // 3) Prevent duplicate court assignment.
  const { count: existingCourts } = await supabase
    .from("qualifying_courts")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id);

  if ((existingCourts ?? 0) > 0) {
    throw new Error("Courts already exist for this bracket.");
  }

  // 4) Load active teams.
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, created_at")
    .eq("bracket_id", bracket.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (teamsError || !teams) {
    throw new Error("Failed to load teams.");
  }

  if (teams.length < 2) {
    throw new Error("At least 2 active teams are required to assign courts.");
  }

  // 5) Create courts based on team count.
  const courtCount = Math.ceil(teams.length / 4);

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

  // 6) Assign teams to courts in registration order.
  const assignments = courts.flatMap((court, courtIdx) => {
    const baseIndex = courtIdx * 4;
    return teams.slice(baseIndex, baseIndex + 4).map((team, idx) => ({
      court_id: court.id,
      team_id: team.id,
      position: idx + 1,
    }));
  });

  // 7) Persist assignments.
  const { error: assignmentsError } = await supabase
    .from("qualifying_assignments")
    .insert(assignments);

  if (assignmentsError) {
    throw new Error("Failed to assign teams to courts.");
  }

  // 8) Initialize stats rows.
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

  // 9) Clear any prior qualification flags.
  await supabase
    .from("teams")
    .update({ qualified: false })
    .eq("bracket_id", bracket.id);

  // 10) Revalidate.
  revalidatePath("/admin/qualifying");
  revalidatePath("/admin/brackets");
  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function setQualifyingStatus(
  bracketType: BracketType,
  status: QualifyingStatus,
): Promise<{ success: true } | { error: string }> {
  try {
  await requireAdmin();

  const bracket = await getBracketByType(bracketType);

  const { error } = await supabase
    .from("brackets")
    .update({ qualifying_status: status })
    .eq("id", bracket.id);

  if (error) {
    throw new Error("Failed to update qualifying status.");
  }

  revalidatePath("/admin/qualifying");
  revalidatePath(`/qualifying/${bracketType}`);
  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function generateQualifyingMatches(
  bracketType: BracketType,
): Promise<{ success: true } | { error: string }> {
  try {
  // 1) Admin gate.
  await requireAdmin();

  // 2) Load bracket and courts.
  const bracket = await getBracketByType(bracketType);

  const { data: courts, error: courtsError } = await supabase
    .from("qualifying_courts")
    .select("id, court_number")
    .eq("bracket_id", bracket.id)
    .order("court_number", { ascending: true });

  if (courtsError || !courts || courts.length === 0) {
    throw new Error("No courts found. Assign teams to courts first.");
  }

  // 3) Prevent duplicate match generation.
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

  // 4) Load court assignments.
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

  // 5) Build round robin matches for each court.
  const incompleteCourts: number[] = [];

  const matches = courts.flatMap((court) => {
    const courtTeams = assignments
      .filter((assignment) => assignment.court_id === court.id)
      .sort((a, b) => a.position - b.position)
      .map((assignment) => {
        const team = Array.isArray(assignment.team)
          ? assignment.team[0]
          : assignment.team;
        return team as { id: string; name: string };
      });

    if (courtTeams.length < 2) {
      incompleteCourts.push(court.court_number);
      return [];
    }

    return buildRoundRobinMatches(courtTeams).map((match) => ({
      court_id: court.id,
      match_index: match.match_index,
      team_a_id: match.team_a_id,
      team_b_id: match.team_b_id,
    }));
  });

  if (incompleteCourts.length > 0) {
    throw new Error(
      `Courts ${incompleteCourts.join(", ")} need at least 2 teams to generate matches.`,
    );
  }

  // 6) Persist matches.
  const { error: insertError } = await supabase
    .from("qualifying_matches")
    .insert(matches);

  if (insertError) {
    throw new Error("Failed to generate qualifying matches.");
  }

  // 7) Revalidate.
  revalidatePath("/admin/qualifying");
  revalidatePath(`/qualifying/${bracketType}`);
  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

async function recomputeCourtStats(courtId: string) {
  const { data: assignments, error: assignmentsError } = await supabase
    .from("qualifying_assignments")
    .select("team:team_id ( id, name )")
    .eq("court_id", courtId);

  if (assignmentsError || !assignments) {
    throw new Error("Failed to load court assignments.");
  }

  const teams = assignments
    .map((assignment) => {
      const team = Array.isArray(assignment.team)
        ? assignment.team[0]
        : assignment.team;
      return team as { id: string; name: string };
    })
    .filter(Boolean);

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

async function updateCourtQualifiers(courtId: string) {
  const { data: assignments, error: assignmentsError } = await supabase
    .from("qualifying_assignments")
    .select("team_id, position")
    .eq("court_id", courtId)
    .order("position", { ascending: true });

  if (assignmentsError || !assignments) {
    throw new Error("Failed to load court assignments.");
  }

  const courtTeams = assignments.map((assignment) => assignment.team_id);

  const { data: stats, error: statsError } = await supabase
    .from("qualifying_team_stats")
    .select("team_id, wins, losses, points_for, points_against, differential")
    .eq("court_id", courtId);

  if (statsError || !stats) {
    throw new Error("Failed to load court stats.");
  }

  const ranked =
    stats.length > 0 ? rankTeams(stats) : courtTeams.map((team_id) => ({
      team_id,
      wins: 0,
      losses: 0,
      points_for: 0,
      points_against: 0,
      differential: 0,
    }));

  const topTeams = ranked.slice(0, Math.min(2, ranked.length)).map((entry) => entry.team_id);

  await supabase
    .from("teams")
    .update({ qualified: true })
    .in("id", topTeams);

  const nonQualified = courtTeams.filter((teamId) => !topTeams.includes(teamId));
  if (nonQualified.length > 0) {
    await supabase
      .from("teams")
      .update({ qualified: false })
      .in("id", nonQualified);
  }
}

export async function reportQualifyingScore(
  matchId: string,
  scoreA: number,
  scoreB: number,
): Promise<{ success: true } | { error: string }> {
  try {
  // 1) Admin gate.
  await requireAdmin();

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    throw new Error("Scores must be whole numbers.");
  }

  if (scoreA < 0 || scoreB < 0) {
    throw new Error("Scores cannot be negative.");
  }

  if (scoreA === scoreB) {
    throw new Error("Qualifying matches cannot end in a tie.");
  }

  // 2) Load match.
  const { data: match, error: matchError } = await supabase
    .from("qualifying_matches")
    .select("id, court_id, team_a_id, team_b_id")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new Error("Match not found.");
  }

  const winnerTeamId = scoreA > scoreB ? match.team_a_id : match.team_b_id;

  // 3) Update match result.
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

  // 4) Recompute stats and qualifiers.
  await recomputeCourtStats(match.court_id);
  await updateCourtQualifiers(match.court_id);

  // 5) Revalidate.
  revalidatePath("/admin/qualifying");
  revalidatePath("/admin/brackets");
  revalidatePath("/qualifying/recreational");
  revalidatePath("/qualifying/competitive");
  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function autoSelectQualifiers(
  bracketType: BracketType,
): Promise<{ success: true } | { error: string }> {
  try {
  // 1) Admin gate.
  await requireAdmin();

  // 2) Load bracket and courts.
  const bracket = await getBracketByType(bracketType);

  const { data: courts, error: courtsError } = await supabase
    .from("qualifying_courts")
    .select("id, court_number")
    .eq("bracket_id", bracket.id);

  if (courtsError || !courts || courts.length === 0) {
    throw new Error("No courts found for this bracket.");
  }

  // 3) Rank each court and mark top teams as qualified.
  for (const court of courts) {
    const { data: stats, error: statsError } = await supabase
      .from("qualifying_team_stats")
      .select("team_id, wins, losses, points_for, points_against, differential")
      .eq("court_id", court.id);

    if (statsError || !stats) {
      throw new Error("Failed to load court stats.");
    }

    const { data: assignments } = await supabase
      .from("qualifying_assignments")
      .select("team_id, position")
      .eq("court_id", court.id)
      .order("position", { ascending: true });

    const courtTeams = assignments?.map((assignment) => assignment.team_id) ?? [];

    const ranked =
      stats.length > 0 ? rankTeams(stats) : courtTeams.map((team_id) => ({
        team_id,
        wins: 0,
        losses: 0,
        points_for: 0,
        points_against: 0,
        differential: 0,
      }));

    const topTwo = ranked.slice(0, Math.min(2, ranked.length)).map((entry) => entry.team_id);

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

  // 4) Revalidate.
  revalidatePath("/admin/qualifying");
  revalidatePath("/admin/brackets");
  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function setCourtQualifiers(
  courtId: string,
  teamIds: string[],
): Promise<{ success: true } | { error: string }> {
  try {
  // 1) Admin gate.
  await requireAdmin();

  if (teamIds.length < 1 || teamIds.length > 2) {
    throw new Error("Select one or two teams to advance.");
  }

  // 2) Load court teams.
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

  // 3) Mark qualified teams.
  await supabase
    .from("teams")
    .update({ qualified: true })
    .in("id", teamIds);

  const nonQualified = courtTeamIds.filter((id) => !teamIds.includes(id));
  // 4) Mark non-qualified teams.
  if (nonQualified.length > 0) {
    await supabase
      .from("teams")
      .update({ qualified: false })
      .in("id", nonQualified);
  }

  // 5) Revalidate.
  revalidatePath("/admin/qualifying");
  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function updateCourtAssignments(
  courtId: string,
  teamIds: Array<string | null>,
): Promise<{ success: true } | { error: string }> {
  try {
  // 1) Admin gate.
  await requireAdmin();

  if (teamIds.filter(Boolean).length < 2) {
    throw new Error("A court needs at least two teams.");
  }

  const uniqueIds = new Set(teamIds.filter(Boolean));
  if (uniqueIds.size !== teamIds.filter(Boolean).length) {
    throw new Error("Teams cannot be duplicated in the same court.");
  }

  // 2) Load court + bracket.
  const { data: court, error: courtError } = await supabase
    .from("qualifying_courts")
    .select("id, bracket_id")
    .eq("id", courtId)
    .single();

  if (courtError || !court) {
    throw new Error("Court not found.");
  }

  const { data: bracket } = await supabase
    .from("brackets")
    .select("type")
    .eq("id", court.bracket_id)
    .single();

  const { data: existingAssignments } = await supabase
    .from("qualifying_assignments")
    .select("team_id")
    .eq("court_id", courtId);

  const previousTeamIds = (existingAssignments ?? []).map((a) => a.team_id);

  // 3) Validate teams belong to bracket.
  const { data: validTeams, error: validTeamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("bracket_id", court.bracket_id)
    .eq("is_active", true)
    .in(
      "id",
      teamIds.filter(Boolean) as string[],
    );

  if (validTeamsError) {
    throw new Error("Failed to validate teams.");
  }

  if ((validTeams ?? []).length !== uniqueIds.size) {
    throw new Error("All teams must belong to this bracket.");
  }

  // 4) Clear conflicts in other courts for moved teams.
  const { data: conflictingAssignments } = await supabase
    .from("qualifying_assignments")
    .select("court_id, team_id")
    .in("team_id", Array.from(uniqueIds))
    .neq("court_id", courtId);

  const conflictedCourtIds = Array.from(
    new Set((conflictingAssignments ?? []).map((assignment) => assignment.court_id)),
  );

  const { data: conflictedCourtTeams } = await supabase
    .from("qualifying_assignments")
    .select("team_id")
    .in("court_id", conflictedCourtIds);

  if (conflictedCourtIds.length > 0) {
    const { error: clearConflictMatchesError } = await supabase
      .from("qualifying_matches")
      .delete()
      .in("court_id", conflictedCourtIds);

    if (clearConflictMatchesError) {
      throw new Error("Failed to clear matches for conflicting courts.");
    }

    const { error: clearConflictAssignmentsError } = await supabase
      .from("qualifying_assignments")
      .delete()
      .in("court_id", conflictedCourtIds);

    if (clearConflictAssignmentsError) {
      throw new Error("Failed to clear assignments for conflicting courts.");
    }
  }

  // 5) Clear current court matches/assignments.
  const { error: clearMatchesError } = await supabase
    .from("qualifying_matches")
    .delete()
    .eq("court_id", courtId);

  if (clearMatchesError) {
    throw new Error("Failed to clear matches for this court.");
  }

  const { error: clearAssignmentsError } = await supabase
    .from("qualifying_assignments")
    .delete()
    .eq("court_id", courtId);

  if (clearAssignmentsError) {
    throw new Error("Failed to clear assignments for this court.");
  }

  const assignments = teamIds
    .map((teamId, index) =>
      teamId
        ? {
            court_id: courtId,
            team_id: teamId,
            position: index + 1,
          }
        : null,
    )
    .filter(Boolean) as Array<{
    court_id: string;
    team_id: string;
    position: number;
  }>;

  // 6) Insert updated assignments.
  if (assignments.length > 0) {
    const { error: assignmentsError } = await supabase
      .from("qualifying_assignments")
      .insert(assignments);

    if (assignmentsError) {
      throw new Error("Failed to update court assignments.");
    }
  }

  const conflictedTeamIds = (conflictedCourtTeams ?? []).map(
    (assignment) => assignment.team_id,
  );

  const allAffectedTeams = Array.from(
    new Set([
      ...previousTeamIds,
      ...assignments.map((a) => a.team_id),
      ...conflictedTeamIds,
    ]),
  );

  // 7) Reset qualification and stats for affected teams.
  if (allAffectedTeams.length > 0) {
    await supabase
      .from("teams")
      .update({ qualified: false })
      .in("id", allAffectedTeams);

    const { error: deleteStatsError } = await supabase
      .from("qualifying_team_stats")
      .delete()
      .in("team_id", allAffectedTeams);

    if (deleteStatsError) {
      throw new Error("Failed to clear qualifying stats for affected teams.");
    }

    const { error: insertStatsError } = await supabase
      .from("qualifying_team_stats")
      .upsert(
        assignments.map((assignment) => ({
          team_id: assignment.team_id,
          court_id: courtId,
        })),
        { onConflict: "team_id" },
      );

    if (insertStatsError) {
      throw new Error("Failed to initialize stats for this court.");
    }
  }

  // 8) Revalidate.
  revalidatePath("/admin/qualifying");
  revalidatePath("/admin/brackets");
  if (bracket?.type) {
    revalidatePath(`/qualifying/${bracket.type}`);
  }
  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function resetQualifying(
  bracketType: BracketType,
): Promise<{ success: true } | { error: string }> {
  try {
  // 1) Admin gate.
  await requireAdmin();

  // 2) Load bracket and courts.
  const bracket = await getBracketByType(bracketType);

  const { data: courts } = await supabase
    .from("qualifying_courts")
    .select("id")
    .eq("bracket_id", bracket.id);

  const courtIds = (courts ?? []).map((court) => court.id);

  // 3) Clear matches, stats, assignments, courts.
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

  // 4) Clear qualifications.
  await supabase
    .from("teams")
    .update({ qualified: false })
    .eq("bracket_id", bracket.id);

  // 5) Revalidate.
  revalidatePath("/admin/qualifying");
  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
