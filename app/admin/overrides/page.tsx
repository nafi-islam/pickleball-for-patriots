import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { AdminOverridesClient } from "@/components/admin/AdminOverridesClient";

type BracketType = "recreational" | "competitive";

async function getCompletedMatches(bracketType: BracketType) {
  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, type")
    .eq("type", bracketType)
    .single();

  if (!bracket) {
    return [];
  }

  const { data: matches } = await supabase
    .from("matches")
    .select(
      `
      id,
      round,
      index_in_round,
      status,
      score_a,
      score_b,
      team_a:team_a_id ( id, name ),
      team_b:team_b_id ( id, name ),
      winner:winner_team_id ( id, name )
    `,
    )
    .eq("bracket_id", bracket.id)
    .eq("status", "COMPLETED")
    .order("round", { ascending: true })
    .order("index_in_round", { ascending: true });

  return (matches ?? []).map((match) => ({
    ...match,
    team_a: Array.isArray(match.team_a) ? match.team_a[0] : match.team_a,
    team_b: Array.isArray(match.team_b) ? match.team_b[0] : match.team_b,
    winner: Array.isArray(match.winner) ? match.winner[0] : match.winner,
  }));
}

export default async function AdminOverridesPage() {
  await requireAdmin();

  const recreationalMatches = await getCompletedMatches("recreational");
  const competitiveMatches = await getCompletedMatches("competitive");

  return (
    <AdminOverridesClient
      recreationalMatches={recreationalMatches}
      competitiveMatches={competitiveMatches}
    />
  );
}
