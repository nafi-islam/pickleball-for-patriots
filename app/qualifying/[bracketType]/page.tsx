import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { PublicQualifyingClient } from "@/components/qualifying/PublicQualifyingClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{ bracketType: string }>;
};

export default async function PublicQualifyingPage({ params }: PageProps) {
  const { bracketType } = await params;

  if (!["recreational", "competitive"].includes(bracketType)) {
    notFound();
  }

  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, type")
    .eq("type", bracketType)
    .single();

  if (!bracket) {
    notFound();
  }

  const { data: courts } = await supabase
    .from("qualifying_courts")
    .select("id, court_number")
    .eq("bracket_id", bracket.id)
    .order("court_number", { ascending: true });

  const courtIds = (courts ?? []).map((court) => court.id);

  const assignments = courtIds.length
    ? (
        await supabase
          .from("qualifying_assignments")
          .select("court_id, position, team:team_id ( id, name )")
          .in("court_id", courtIds)
      ).data
    : [];

  const matches = courtIds.length
    ? (
        await supabase
          .from("qualifying_matches")
          .select(
            `
      id,
      court_id,
      match_index,
      status,
      score_a,
      score_b,
      team_a:team_a_id ( id, name ),
      team_b:team_b_id ( id, name )
    `,
          )
          .in("court_id", courtIds)
          .order("match_index", { ascending: true })
      ).data
    : [];

  const stats = courtIds.length
    ? (
        await supabase
          .from("qualifying_team_stats")
          .select(
            "team_id, court_id, wins, losses, points_for, points_against, differential",
          )
          .in("court_id", courtIds)
      ).data
    : [];

  return (
    <PublicQualifyingClient
      bracketType={bracketType as "recreational" | "competitive"}
      courts={courts ?? []}
      assignments={(assignments ?? []).map((assignment) => ({
        ...assignment,
        team: Array.isArray(assignment.team)
          ? assignment.team[0] ?? null
          : assignment.team,
      }))}
      matches={(matches ?? []).map((match) => ({
        ...match,
        team_a: Array.isArray(match.team_a) ? match.team_a[0] ?? null : match.team_a,
        team_b: Array.isArray(match.team_b) ? match.team_b[0] ?? null : match.team_b,
      }))}
      stats={stats ?? []}
    />
  );
}
