"use server";

import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function withdrawTeam(teamId: string) {
  await requireAdmin();

  const { error } = await supabase
    .from("teams")
    .update({ is_active: false })
    .eq("id", teamId);

  if (error) {
    throw new Error("Failed to withdraw team.");
  }
}
