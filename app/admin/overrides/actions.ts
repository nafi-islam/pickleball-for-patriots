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
 * 3. Re-apply bye auto-advancement for a bracket.
 *    If a match has exactly one team and no winner, mark it complete and
 *    advance that team. This repairs accidental undo of byes.
 */
async function autoAdvanceByes(bracketId: string) {
  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      "id, round, index_in_round, team_a_id, team_b_id, winner_team_id, score_a, score_b, status",
    )
    .eq("bracket_id", bracketId)
    .order("round", { ascending: true })
    .order("index_in_round", { ascending: true });

  if (error || !matches) {
    throw new Error("Failed to load matches for bye recovery.");
  }

  for (const match of matches) {
    const hasTeamA = !!match.team_a_id;
    const hasTeamB = !!match.team_b_id;

    if (match.winner_team_id || match.status === "COMPLETED") {
      continue;
    }

    if (hasTeamA === hasTeamB) {
      continue;
    }

    const winnerId = (match.team_a_id ?? match.team_b_id)!;

    const { error: winnerUpdateError } = await supabase
      .from("matches")
      .update({
        winner_team_id: winnerId,
        status: "COMPLETED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (winnerUpdateError) {
      throw new Error("Failed to restore bye winner.");
    }

    const nextRound = match.round + 1;
    const nextMatchIndex = getNextMatchIndex(match.index_in_round);
    const nextSlot = getNextMatchSlot(match.index_in_round);

    const { data: nextMatch } = await supabase
      .from("matches")
      .select("id, team_a_id, team_b_id")
      .eq("bracket_id", bracketId)
      .eq("round", nextRound)
      .eq("index_in_round", nextMatchIndex)
      .maybeSingle();

    if (!nextMatch) {
      continue;
    }

    const existingSlotValue =
      nextSlot === "team_a_id" ? nextMatch.team_a_id : nextMatch.team_b_id;

    if (!existingSlotValue || existingSlotValue === winnerId) {
      const { error: advanceError } = await supabase
        .from("matches")
        .update({ [nextSlot]: winnerId, updated_at: new Date().toISOString() })
        .eq("id", nextMatch.id);

      if (advanceError) {
        throw new Error("Failed to re-advance bye winner.");
      }
    }
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
export async function undoMatchResult(matchId: string): Promise<{ success: true } | { error: string }> {
  try {
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

  const isByeMatch =
    (match.team_a_id && !match.team_b_id) ||
    (!match.team_a_id && match.team_b_id);

  if (isByeMatch) {
    throw new Error(
      "Bye matches cannot be undone. Use bracket reset or manual seeding instead.",
    );
  }

  await clearMatchResult(match.id);
  await removeAdvancedWinnerFromNextMatch(match as MatchRow);
  await autoAdvanceByes(match.bracket_id);

  revalidatePath("/admin/overrides");
  revalidatePath("/admin/scoring");
  revalidatePath("/admin/brackets");
  revalidatePath("/bracket/recreational");
  revalidatePath("/bracket/competitive");

  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
