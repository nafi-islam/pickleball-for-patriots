import { AdminTeamsClient } from "@/components/admin/AdminTeamsClient";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { fetchTicketPayments } from "@/lib/stripe";

type TeamRow = {
  id: string;
  name: string;
  contact_email: string;
  is_active: boolean;
  bracket_type: string;
  players: {
    name: string;
    email: string;
  }[];
};

async function fetchTeams(bracketType: "recreational" | "competitive") {
  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("id")
    .eq("type", bracketType)
    .single();

  if (bracketError || !bracket) {
    return [];
  }

  const { data } = await supabase
    .from("teams")
    .select(
      `
      id,
      name,
      contact_email,
      is_active,
      players(name, email)
    `,
    )
    .eq("bracket_id", bracket.id)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export default async function AdminTeamsPage() {
  await requireAdmin();

  const [recreationalTeams, competitiveTeams, paidTickets] = await Promise.all([
    fetchTeams("recreational"),
    fetchTeams("competitive"),
    fetchTicketPayments(),
  ]);

  const paidEmails = paidTickets.map((t) => t.email);

  return (
    <AdminTeamsClient
      recreationalTeams={recreationalTeams as unknown as TeamRow[]}
      competitiveTeams={competitiveTeams as unknown as TeamRow[]}
      paidEmails={paidEmails}
    />
  );
}
