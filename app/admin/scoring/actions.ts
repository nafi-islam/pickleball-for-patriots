"use server";

import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getNextMatchIndex, getNextMatchSlot } from "@/lib/bracket";

type ReportScoreInput = {
  matchId: string;
  scoreA: number;
  scoreB: number;
};

type SetCourtInput = {
  matchId: string;
  court: number | null;
};

export async function reportMatchResult({
  matchId,
  scoreA,
  scoreB,
}: ReportScoreInput): Promise<{ success: true } | { error: string }> {
  try {
  // 1. Require admin access
  await requireAdmin();

  // 2. Validate scores
  if (
    !Number.isInteger(scoreA) ||
    !Number.isInteger(scoreB) ||
    scoreA < 0 ||
    scoreB < 0
  ) {
    throw new Error("Scores must be non-negative integers.");
  }

  if (scoreA === scoreB) {
    throw new Error("Scores cannot be tied.");
  }

  // 3. Fetch the match
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, bracket_id, round, index_in_round, team_a_id, team_b_id, winner_team_id, status",
    )
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new Error("Match not found.");
  }

  // 4. Make sure both teams are present
  if (!match.team_a_id || !match.team_b_id) {
    throw new Error("This match is not ready for scoring.");
  }

  // 5. Prevent double-scoring
  if (match.status === "COMPLETED" || match.winner_team_id) {
    throw new Error("This match has already been completed.");
  }

  // 6. Determine winner
  const winnerTeamId = scoreA > scoreB ? match.team_a_id : match.team_b_id;

  // 7. Update the current match
  const { error: updateMatchError } = await supabase
    .from("matches")
    .update({
      score_a: scoreA,
      score_b: scoreB,
      winner_team_id: winnerTeamId,
      status: "COMPLETED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", match.id);

  if (updateMatchError) {
    throw new Error("Failed to save match result.");
  }

  // 8. Find whether a next match exists
  const nextRound = match.round + 1;
  const nextMatchIndex = getNextMatchIndex(match.index_in_round);
  const nextSlot = getNextMatchSlot(match.index_in_round);

  const { data: nextMatch, error: nextMatchError } = await supabase
    .from("matches")
    .select("id")
    .eq("bracket_id", match.bracket_id)
    .eq("round", nextRound)
    .eq("index_in_round", nextMatchIndex)
    .maybeSingle();

  if (nextMatchError) {
    throw new Error("Failed to locate the next match.");
  }

  // 9. If there is a next match, advance the winner
  if (nextMatch) {
    const { error: advanceError } = await supabase
      .from("matches")
      .update({
        [nextSlot]: winnerTeamId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", nextMatch.id);

    if (advanceError) {
      throw new Error("Failed to advance the winning team.");
    }
  }

  // 10. Success
  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function setMatchCourt({ matchId, court }: SetCourtInput): Promise<{ success: true } | { error: string }> {
  try {
  await requireAdmin();

  if (court !== null && (!Number.isInteger(court) || court < 1 || court > 8)) {
    throw new Error("Court must be between 1 and 8.");
  }

  const { error } = await supabase
    .from("matches")
    .update({
      court: court ? `Court ${court}` : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    throw new Error("Failed to update court.");
  }

  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
