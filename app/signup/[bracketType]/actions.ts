"use server";

import { supabase } from "@/lib/supabase";

type BracketType = "recreational" | "competitive";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function registerTeam(
  bracketType: BracketType,
  formData: {
    teamName: string;
    contactEmail: string;
    player1Name: string;
    player1Email: string;
    player2Name: string;
    player2Email: string;
  },
) {
  // Validate bracket
  if (!["recreational", "competitive"].includes(bracketType)) {
    throw new Error("Invalid bracket type.");
  }

  // Validate emails
  const emails = [
    formData.contactEmail,
    formData.player1Email,
    formData.player2Email,
  ];

  for (const email of emails) {
    if (!isValidEmail(email)) {
      throw new Error("Please provide valid email addresses.");
    }
  }

  // Fetch bracket
  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("id")
    .eq("type", bracketType)
    .single();

  if (bracketError || !bracket) {
    throw new Error("Bracket not found.");
  }

  // Enforce 32-team cap
  const { count } = await supabase
    .from("teams")
    .select("*", { count: "exact", head: true })
    .eq("bracket_id", bracket.id)
    .eq("is_active", true);

  if ((count ?? 0) >= 32) {
    throw new Error("This bracket is full.");
  }

  // Prevent duplicate registration by contact email
  const { count: existingTeams } = await supabase
    .from("teams")
    .select("*", { count: "exact", head: true })
    .eq("bracket_id", bracket.id)
    .eq("contact_email", formData.contactEmail)
    .eq("is_active", true);

  if ((existingTeams ?? 0) > 0) {
    throw new Error(
      "This email has already registered a team for this bracket.",
    );
  }

  // Simple rate limiting (same email, last 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { count: recentAttempts } = await supabase
    .from("teams")
    .select("*", { count: "exact", head: true })
    .eq("contact_email", formData.contactEmail)
    .gte("created_at", tenMinutesAgo);

  if ((recentAttempts ?? 0) >= 1) {
    throw new Error(
      "Please wait a few minutes before submitting another registration.",
    );
  }

  // Create team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      bracket_id: bracket.id,
      name: formData.teamName,
      contact_email: formData.contactEmail,
    })
    .select()
    .single();

  if (teamError || !team) {
    throw new Error("Failed to create team.");
  }

  // Create players
  const { error: playerError } = await supabase.from("players").insert([
    {
      team_id: team.id,
      name: formData.player1Name,
      email: formData.player1Email,
    },
    {
      team_id: team.id,
      name: formData.player2Name,
      email: formData.player2Email,
    },
  ]);

  if (playerError) {
    throw new Error("Failed to create players.");
  }

  return { success: true };
}
