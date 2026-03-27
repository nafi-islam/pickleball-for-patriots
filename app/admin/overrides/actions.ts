"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getNextMatchIndex, getNextMatchSlot } from "@/lib/bracket";

type MatchRow = {
  id: string;
  bracket_id: string;
  round: number;
  index_in_round: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id: string | null;
  score_a: number | null;
  score_b: number | null;
  status: string | null;
};

/**
 * 1. Clear a single match result back to pending.
 */
async function clearMatchResult(matchId: string) {
  const { error } = await supabase
    .from("matches")
    .update({
      score_a: null,
      score_b: null,
      winner_team_id: null,
      status: "PENDING",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    throw new Error("Failed to clear match result.");
  }
}

/**
 * 2. Remove a team from the correct slot in the next match.
 */
async function removeAdvancedWinnerFromNextMatch(match: MatchRow) {
  const nextRound = match.round + 1;
  const nextMatchIndex = getNextMatchIndex(match.index_in_round);
  const nextSlot = getNextMatchSlot(match.index_in_round);

  const { data: nextMatch, error: nextMatchError } = await supabase
    .from("matches")
    .select(
      "id, bracket_id, round, index_in_round, team_a_id, team_b_id, winner_team_id, score_a, score_b, status",
    )
    .eq("bracket_id", match.bracket_id)
    .eq("round", nextRound)
    .eq("index_in_round", nextMatchIndex)
    .maybeSingle();

  if (nextMatchError) {
    throw new Error("Failed to locate downstream match.");
  }

  if (!nextMatch) {
    return;
  }

  const updates =
    nextSlot === "team_a_id"
      ? { team_a_id: null, updated_at: new Date().toISOString() }
      : { team_b_id: null, updated_at: new Date().toISOString() };

  const { error: removeError } = await supabase
    .from("matches")
    .update(updates)
    .eq("id", nextMatch.id);

  if (removeError) {
    throw new Error("Failed to remove advanced winner from downstream match.");
  }

  const nextMatchDependsOnPriorResult =
    nextMatch.winner_team_id !== null ||
    nextMatch.score_a !== null ||
    nextMatch.score_b !== null ||
    nextMatch.status === "COMPLETED";

  if (nextMatchDependsOnPriorResult) {
    await clearDownstreamBranch(nextMatch as MatchRow);
  }
}

/**
 * 3. Recursively clear a completed or partially derived downstream branch.
 */
async function clearDownstreamBranch(match: MatchRow) {
  await clearMatchResult(match.id);
  await removeAdvancedWinnerFromNextMatch({
    ...match,
    winner_team_id: null,
  });
}

/**
 * 4. Undo a completed match result and clear any invalid downstream state.
 */
export async function undoMatchResult(matchId: string) {
  await requireAdmin();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, bracket_id, round, index_in_round, team_a_id, team_b_id, winner_team_id, score_a, score_b, status",
    )
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new Error("Match not found.");
  }

  if (match.status !== "COMPLETED" || !match.winner_team_id) {
    throw new Error("Only completed matches can be undone.");
  }

  await clearMatchResult(match.id);
  await removeAdvancedWinnerFromNextMatch(match as MatchRow);

  revalidatePath("/admin/overrides");
  revalidatePath("/admin/scoring");
  revalidatePath("/admin/brackets");
  revalidatePath("/bracket/recreational");
  revalidatePath("/bracket/competitive");

  return { success: true };
}
