import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { AdminBracketsClient } from "@/components/admin/AdminBracketsClient";

async function getBracketSummary(type: "recreational" | "competitive") {
  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, type, status")
    .eq("type", type)
    .single();

  if (!bracket) {
    return null;
  }

  const { count: activeTeamCount } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id)
    .eq("is_active", true);

  const { count: matchCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id);

  return {
    ...bracket,
    activeTeamCount: activeTeamCount ?? 0,
    matchCount: matchCount ?? 0,
  };
}

export default async function AdminBracketsPage() {
  await requireAdmin();

  const recreational = await getBracketSummary("recreational");
  const competitive = await getBracketSummary("competitive");

  const brackets = [recreational, competitive].filter(
    (bracket): bracket is NonNullable<typeof bracket> => Boolean(bracket),
  );

  return <AdminBracketsClient brackets={brackets} />;
}
