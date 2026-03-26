import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { AdminScoringClient } from "@/components/admin/AdminScoringClient";

type BracketType = "recreational" | "competitive";

async function getScorableMatches(bracketType: BracketType) {
  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, type, status")
    .eq("type", bracketType)
    .single();

  if (!bracket) {
    return { bracket: null, matches: [] };
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
    .order("round", { ascending: true })
    .order("index_in_round", { ascending: true });

  return { bracket, matches: matches ?? [] };
}

export default async function AdminScoringPage() {
  await requireAdmin();

  const recreational = await getScorableMatches("recreational");
  const competitive = await getScorableMatches("competitive");

  const normalizeMatches = (matches: typeof recreational.matches) =>
    matches.map((match) => ({
      ...match,
      team_a: Array.isArray(match.team_a) ? match.team_a[0] ?? null : match.team_a,
      team_b: Array.isArray(match.team_b) ? match.team_b[0] ?? null : match.team_b,
      winner: Array.isArray(match.winner) ? match.winner[0] ?? null : match.winner,
    }));

  return (
    <AdminScoringClient
      recreationalMatches={normalizeMatches(recreational.matches)}
      competitiveMatches={normalizeMatches(competitive.matches)}
    />
  );
}
