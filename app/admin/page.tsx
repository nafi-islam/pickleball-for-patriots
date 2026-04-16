import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { fetchTicketPayments } from "@/lib/stripe";

const MAX_TEAMS_PER_BRACKET = 32;

async function fetchTournamentOverview() {
  const { data } = await supabase
    .from("tournaments")
    .select("name, location, event_date, status, updated_at")
    .order("event_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

async function fetchBracketIds() {
  const { data } = await supabase.from("brackets").select("id, type");
  return {
    recreationalId: data?.find((b) => b.type === "recreational")?.id ?? null,
    competitiveId: data?.find((b) => b.type === "competitive")?.id ?? null,
  };
}

export default async function AdminPage() {
  await requireAdmin();

  const [{ recreationalId, competitiveId }, tournament, ticketPayments] =
    await Promise.all([
      fetchBracketIds(),
      fetchTournamentOverview(),
      fetchTicketPayments(),
    ]);

  const [
    totalTeams,
    activeTeams,
    withdrawnTeams,
    totalPlayers,
    recTeams,
    compTeams,
  ] = await Promise.all([
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("is_active", false),
    supabase.from("players").select("id", { count: "exact", head: true }),
    recreationalId
      ? supabase
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("bracket_id", recreationalId)
          .eq("is_active", true)
      : Promise.resolve({ count: 0 }),
    competitiveId
      ? supabase
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("bracket_id", competitiveId)
          .eq("is_active", true)
      : Promise.resolve({ count: 0 }),
  ]);

  const totalTeamsCount = totalTeams.count ?? 0;
  const activeTeamsCount = activeTeams.count ?? 0;
  const withdrawnTeamsCount = withdrawnTeams.count ?? 0;
  const totalPlayersCount = totalPlayers.count ?? 0;
  const recTeamsCount = recTeams.count ?? 0;
  const compTeamsCount = compTeams.count ?? 0;

  return (
    <AdminDashboardClient
      stats={{
        totalTeams: totalTeamsCount,
        activeTeams: activeTeamsCount,
        withdrawnTeams: withdrawnTeamsCount,
        totalPlayers: totalPlayersCount,
        recreationalTeams: recTeamsCount,
        competitiveTeams: compTeamsCount,
        maxTeams: MAX_TEAMS_PER_BRACKET,
      }}
      tournament={tournament}
      ticketPayments={ticketPayments}
    />
  );
}
