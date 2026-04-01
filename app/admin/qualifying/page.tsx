import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { AdminQualifyingClient } from "@/components/admin/AdminQualifyingClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type BracketType = "recreational" | "competitive";

async function fetchQualifyingData(bracketType: BracketType) {
  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, type")
    .eq("type", bracketType)
    .single();

  if (!bracket) {
    return null;
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
          .select("id, court_id, position, team:team_id ( id, name, qualified )")
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
      team_b:team_b_id ( id, name ),
      winner:winner_team_id ( id, name )
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

  const { count: activeTeams } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id)
    .eq("is_active", true);

  const { count: qualifiedTeams } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id)
    .eq("qualified", true);

  return {
    bracket,
    courts: courts ?? [],
    assignments: (assignments ?? []).map((assignment) => ({
      ...assignment,
      team: Array.isArray(assignment.team)
        ? assignment.team[0] ?? null
        : assignment.team,
    })),
    matches: (matches ?? []).map((match) => ({
      ...match,
      team_a: Array.isArray(match.team_a) ? match.team_a[0] ?? null : match.team_a,
      team_b: Array.isArray(match.team_b) ? match.team_b[0] ?? null : match.team_b,
      winner: Array.isArray(match.winner) ? match.winner[0] ?? null : match.winner,
    })),
    stats: stats ?? [],
    activeTeams: activeTeams?.count ?? 0,
    qualifiedTeams: qualifiedTeams?.count ?? 0,
  };
}

export default async function AdminQualifyingPage() {
  await requireAdmin();

  const recreational = await fetchQualifyingData("recreational");
  const competitive = await fetchQualifyingData("competitive");

  return (
    <AdminQualifyingClient
      recreational={recreational}
      competitive={competitive}
    />
  );
}
