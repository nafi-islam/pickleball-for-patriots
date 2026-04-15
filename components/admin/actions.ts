"use server";

import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function withdrawTeam(teamId: string): Promise<{ success: true } | { error: string }> {
  try {
  await requireAdmin();

  const { error } = await supabase
    .from("teams")
    .update({ is_active: false })
    .eq("id", teamId);

  if (error) {
    throw new Error("Failed to withdraw team.");
  }

  return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
