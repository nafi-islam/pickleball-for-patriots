"use server";

import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  buildSlots,
  getNextMatchIndex,
  getNextMatchSlot,
  getNextPowerOfTwo,
  getRoundCount,
  getRoundOnePairings,
} from "@/lib/bracket";

type BracketType = "recreational" | "competitive";

export async function generateBracket(bracketType: BracketType) {
  // 1. Require admin
  await requireAdmin();

  // 2. Fetch bracket
  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("id, status")
    .eq("type", bracketType)
    .single();

  if (bracketError || !bracket) {
    throw new Error("Bracket not found.");
  }

  // 3. Prevent duplicate generation
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

  // 4. Fetch active teams in registration order
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

  // 5. Build bracket structure
  const bracketSize = getNextPowerOfTwo(teams.length);
  const roundCount = getRoundCount(bracketSize);
  const slots = buildSlots(teams, bracketSize);
  const roundOnePairings = getRoundOnePairings(slots);

  // 6. Create all matches
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

  // Round 1
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

  // Future rounds
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

  // 7. Insert all matches
  const { data: insertedMatches, error: insertMatchesError } = await supabase
    .from("matches")
    .insert(allMatches)
    .select("id, round, index_in_round");

  if (insertMatchesError || !insertedMatches) {
    throw new Error("Failed to create matches.");
  }

  // 8. Auto-advance byes from round 1 into round 2
  const roundOneInserted = allMatches.filter((m) => m.round === 1);

  for (const match of roundOneInserted) {
    if (!match.winner_team_id) continue;

    const nextRound = 2;
    if (nextRound > roundCount) continue;

    const nextMatchIndex = getNextMatchIndex(match.index_in_round);
    const slotColumn = getNextMatchSlot(match.index_in_round);

    const { error: advanceError } = await supabase
      .from("matches")
      .update({ [slotColumn]: match.winner_team_id })
      .eq("bracket_id", bracket.id)
      .eq("round", nextRound)
      .eq("index_in_round", nextMatchIndex);

    if (advanceError) {
      throw new Error("Failed to auto-advance bye.");
    }
  }

  // 9. Update bracket status
  const { error: updateBracketError } = await supabase
    .from("brackets")
    .update({ status: "GENERATED" })
    .eq("id", bracket.id);

  if (updateBracketError) {
    throw new Error(
      "Bracket generated, but bracket status could not be updated.",
    );
  }

  // 10. Success
  return { success: true };
}
