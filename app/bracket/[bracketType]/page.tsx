import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { PublicBracketClient } from "@/components/bracket/PublicBracketClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ bracketType: string }>;
};

export default async function PublicBracketPage({ params }: PageProps) {
  const { bracketType } = await params;

  if (!["recreational", "competitive"].includes(bracketType)) {
    notFound();
  }

  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("id, type, status")
    .eq("type", bracketType)
    .single();

  if (bracketError) {
    console.error("[public/bracket] bracket lookup failed", {
      bracketType,
      message: bracketError.message,
    });
  }

  if (!bracket) {
    console.warn("[public/bracket] bracket not found", { bracketType });
    notFound();
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
      court,
      team_a:team_a_id ( id, name ),
      team_b:team_b_id ( id, name ),
      winner:winner_team_id ( id, name )
    `,
    )
    .eq("bracket_id", bracket.id)
    .order("round", { ascending: true })
    .order("index_in_round", { ascending: true });

  if (matchesError) {
    console.error("[public/bracket] match fetch failed", {
      bracketType,
      bracketId: bracket.id,
      message: matchesError.message,
    });
  }

  const normalizedMatches = (matches ?? []).map((match) => ({
    ...match,
    team_a: Array.isArray(match.team_a) ? match.team_a[0] ?? null : match.team_a,
    team_b: Array.isArray(match.team_b) ? match.team_b[0] ?? null : match.team_b,
    winner: Array.isArray(match.winner) ? match.winner[0] ?? null : match.winner,
  }));

  return (
    <PublicBracketClient
      bracketType={bracketType as "recreational" | "competitive"}
      status={bracket.status}
      matches={normalizedMatches}
    />
  );
}
