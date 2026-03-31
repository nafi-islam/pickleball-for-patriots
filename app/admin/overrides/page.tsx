import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { AdminOverridesClient } from "@/components/admin/AdminOverridesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type BracketType = "recreational" | "competitive";

async function getCompletedMatches(bracketType: BracketType) {
  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("id, type")
    .eq("type", bracketType)
    .single();

  if (bracketError) {
    console.error("[admin/overrides] bracket lookup failed", {
      bracketType,
      message: bracketError.message,
    });
  }

  if (!bracket) {
    console.warn("[admin/overrides] bracket not found", { bracketType });
    return [];
  }

  const { data: matches, error: matchesError } = await supabase
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

  if (matchesError) {
    console.error("[admin/overrides] match fetch failed", {
      bracketType,
      bracketId: bracket.id,
      message: matchesError.message,
    });
  }

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
