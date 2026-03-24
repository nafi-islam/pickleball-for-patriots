import { AdminTeamsClient } from "@/components/admin/AdminTeamsClient";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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
  const { data } = await supabase
    .from("teams")
    .select(
      `
      id,
      name,
      contact_email,
      is_active,
      brackets(type),
      players(name, email)
    `,
    )
    .eq("brackets.type", bracketType)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export default async function AdminTeamsPage() {
  await requireAdmin();

  const recreationalTeams = await fetchTeams("recreational");
  const competitiveTeams = await fetchTeams("competitive");

  return (
    <AdminTeamsClient
      recreationalTeams={recreationalTeams as unknown as TeamRow[]}
      competitiveTeams={competitiveTeams as unknown as TeamRow[]}
    />
  );
}
