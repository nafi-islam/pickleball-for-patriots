"use server";

import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  buildRoundOnePairings,
  getNextMatchIndex,
  getNextMatchSlot,
  getNextPowerOfTwo,
  getRoundCount,
} from "@/lib/bracket";

type BracketType = "recreational" | "competitive";
const MAX_TEAMS_PER_BRACKET = 32;
type BracketStatus = "DRAFT" | "GENERATED" | "PUBLISHED";

export async function generateBracket(bracketType: BracketType) {
  // 1) Admin gate: bracket generation is an ops-only action.
  await requireAdmin();

  // 2) Load bracket and current status.
  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("id, status")
    .eq("type", bracketType)
    .single();

  if (bracketError || !bracket) {
    throw new Error("Bracket not found.");
  }

  // 3) Prevent duplicate generation (matches already exist).
  const { count: existingMatchCount, error: existingMatchCountError } =
    await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("bracket_id", bracket.id);

  if (existingMatchCountError) {
    throw new Error("Could not validate existing matches.");
  }

  if ((existingMatchCount ?? 0) > 0) {
    throw new Error("Bracket has already been generated.");
  }

  // 4) Fetch active teams in registration order (deterministic seeding).
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, created_at")
    .eq("bracket_id", bracket.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (teamsError || !teams) {
    throw new Error("Could not fetch active teams.");
  }

  if (teams.length < 2) {
    throw new Error(
      "At least two active teams are required to generate a bracket.",
    );
  }

  if (teams.length > MAX_TEAMS_PER_BRACKET) {
    throw new Error("This bracket exceeds the maximum team limit.");
  }

  // 5) Build bracket structure: next power of two, slot padding for byes.
  const bracketSize = getNextPowerOfTwo(teams.length);
  const roundCount = getRoundCount(bracketSize);
  const roundOnePairings = buildRoundOnePairings(teams, bracketSize);

  // 6) Create all matches upfront (full elimination tree).
  const allMatches: Array<{
    bracket_id: string;
    round: number;
    index_in_round: number;
    team_a_id: string | null;
    team_b_id: string | null;
    winner_team_id: string | null;
    status: string;
    court: string | null;
    order_in_round: number | null;
  }> = [];

  // Round 1: set initial teams; pre-resolve byes as immediate wins.
  roundOnePairings.forEach((pairing, index) => {
    const winnerId =
      pairing.teamA && !pairing.teamB
        ? pairing.teamA.id
        : pairing.teamB && !pairing.teamA
          ? pairing.teamB.id
          : null;

    allMatches.push({
      bracket_id: bracket.id,
      round: 1,
      index_in_round: index + 1,
      team_a_id: pairing.teamA?.id ?? null,
      team_b_id: pairing.teamB?.id ?? null,
      winner_team_id: winnerId,
      status: winnerId ? "COMPLETED" : "PENDING",
      court: null,
      order_in_round: index + 1,
    });
  });

  // Future rounds: empty slots to be filled by winners.
  for (let round = 2; round <= roundCount; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);

    for (let i = 1; i <= matchesInRound; i++) {
      allMatches.push({
        bracket_id: bracket.id,
        round,
        index_in_round: i,
        team_a_id: null,
        team_b_id: null,
        winner_team_id: null,
        status: "PENDING",
        court: null,
        order_in_round: i,
      });
    }
  }

  // 7) Insert all matches in one batch.
  const { data: insertedMatches, error: insertMatchesError } = await supabase
    .from("matches")
    .insert(allMatches)
    .select("id, round, index_in_round");

  if (insertMatchesError || !insertedMatches) {
    throw new Error("Failed to create matches.");
  }

  // 8) Auto-advance byes across rounds:
  //    - If a match has exactly one team, mark it complete and advance the winner.
  //    - Repeat for all rounds so single-team paths propagate.
  const { data: generatedMatches, error: generatedMatchesError } = await supabase
    .from("matches")
    .select(
      "id, round, index_in_round, team_a_id, team_b_id, winner_team_id, status",
    )
    .eq("bracket_id", bracket.id)
    .order("round", { ascending: true })
    .order("index_in_round", { ascending: true });

  if (generatedMatchesError || !generatedMatches) {
    throw new Error("Failed to load generated matches.");
  }

  // Helper: place winner into the correct slot of the next round.
  const advanceWinner = async (
    matchRound: number,
    indexInRound: number,
    winnerId: string,
  ) => {
    const nextRound = matchRound + 1;
    if (nextRound > roundCount) return;

    const nextMatchIndex = getNextMatchIndex(indexInRound);
    const slotColumn = getNextMatchSlot(indexInRound);

    const { error: advanceError } = await supabase
      .from("matches")
      .update({ [slotColumn]: winnerId })
      .eq("bracket_id", bracket.id)
      .eq("round", nextRound)
      .eq("index_in_round", nextMatchIndex);

    if (advanceError) {
      throw new Error("Failed to auto-advance bye.");
    }
  };

  for (let round = 1; round <= roundCount; round++) {
    const matchesInRound = generatedMatches.filter((m) => m.round === round);

    for (const match of matchesInRound) {
      const hasTeamA = !!match.team_a_id;
      const hasTeamB = !!match.team_b_id;

      let winnerId = match.winner_team_id;
      if (!winnerId && hasTeamA !== hasTeamB) {
        winnerId = (match.team_a_id ?? match.team_b_id)!;
        const { error: winnerUpdateError } = await supabase
          .from("matches")
          .update({ winner_team_id: winnerId, status: "COMPLETED" })
          .eq("id", match.id);

        if (winnerUpdateError) {
          throw new Error("Failed to record bye winner.");
        }
      }

      if (winnerId) {
        await advanceWinner(match.round, match.index_in_round, winnerId);
      }
    }
  }

  // 9) Mark bracket as generated.
  const { error: updateBracketError } = await supabase
    .from("brackets")
    .update({ status: "GENERATED" })
    .eq("id", bracket.id);

  if (updateBracketError) {
    throw new Error(
      "Bracket generated, but bracket status could not be updated.",
    );
  }

  // 10) Success
  return { success: true };
}

export async function setBracketStatus(
  bracketType: BracketType,
  status: BracketStatus,
) {
  await requireAdmin();

  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("id")
    .eq("type", bracketType)
    .single();

  if (bracketError || !bracket) {
    throw new Error("Bracket not found.");
  }

  const { error } = await supabase
    .from("brackets")
    .update({ status })
    .eq("id", bracket.id);

  if (error) {
    throw new Error("Failed to update bracket status.");
  }

  return { success: true };
}

export async function resetBracket(bracketType: BracketType) {
  await requireAdmin();

  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("id")
    .eq("type", bracketType)
    .single();

  if (bracketError || !bracket) {
    throw new Error("Bracket not found.");
  }

  const { error: deleteError } = await supabase
    .from("matches")
    .delete()
    .eq("bracket_id", bracket.id);

  if (deleteError) {
    throw new Error("Failed to reset matches for this bracket.");
  }

  const { error: statusError } = await supabase
    .from("brackets")
    .update({ status: "DRAFT" })
    .eq("id", bracket.id);

  if (statusError) {
    throw new Error("Failed to reset bracket status.");
  }

  return { success: true };
}

export async function updateMatchParticipants(
  matchId: string,
  teamAId: string | null,
  teamBId: string | null,
) {
  await requireAdmin();

  if (!teamAId && !teamBId) {
    throw new Error("At least one team must be assigned.");
  }

  if (teamAId && teamBId && teamAId === teamBId) {
    throw new Error("A team cannot play itself.");
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, bracket_id, round, score_a, score_b, winner_team_id")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new Error("Match not found.");
  }

  if (match.round !== 1) {
    throw new Error("Only round 1 matches can be manually seeded.");
  }

  if (
    match.score_a !== null ||
    match.score_b !== null ||
    match.winner_team_id !== null
  ) {
    throw new Error("Cannot edit a match that already has a result.");
  }

  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("id, status")
    .eq("id", match.bracket_id)
    .single();

  if (bracketError || !bracket) {
    throw new Error("Bracket not found.");
  }

  if (bracket.status === "PUBLISHED") {
    throw new Error("Unpublish the bracket before editing seeding.");
  }

  const teamIds = [teamAId, teamBId].filter(
    (value): value is string => Boolean(value),
  );

  if (teamIds.length > 0) {
    const { count: validTeamsCount, error: validTeamsError } = await supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("bracket_id", match.bracket_id)
      .in("id", teamIds);

    if (validTeamsError) {
      throw new Error("Failed to validate teams.");
    }

    if ((validTeamsCount ?? 0) !== teamIds.length) {
      throw new Error("All selected teams must belong to this bracket.");
    }
  }

  // Prevent duplicate team assignments across round 1.
  if (teamIds.length > 0) {
    const { data: roundOneMatches, error: roundOneError } = await supabase
      .from("matches")
      .select("id, team_a_id, team_b_id")
      .eq("bracket_id", match.bracket_id)
      .eq("round", 1)
      .neq("id", match.id);

    if (roundOneError) {
      throw new Error("Failed to validate round 1 assignments.");
    }

    const usedIds = new Set<string>();
    for (const roundMatch of roundOneMatches ?? []) {
      if (roundMatch.team_a_id) usedIds.add(roundMatch.team_a_id);
      if (roundMatch.team_b_id) usedIds.add(roundMatch.team_b_id);
    }

    if (teamIds.some((id) => usedIds.has(id))) {
      throw new Error("Each team can only appear once in round 1.");
    }
  }

  const { error } = await supabase
    .from("matches")
    .update({
      team_a_id: teamAId,
      team_b_id: teamBId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    throw new Error("Failed to update match participants.");
  }

  return { success: true };
}
