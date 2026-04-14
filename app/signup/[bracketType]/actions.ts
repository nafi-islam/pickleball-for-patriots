"use server";

import { supabase } from "@/lib/supabase";
import { fetchTicketPayments } from "@/lib/stripe";

type BracketType = "recreational" | "competitive";

const MAX_TEAMS_PER_BRACKET = 32;

type RegisterTeamInput = {
  teamName: string;
  contactEmail: string;
  player1Name: string;
  player1Email: string;
  player2Name: string;
  player2Email: string;
};

// Email format check
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// Normalize user input to prevent duplicates and whitespace issues
function normalizeInput(formData: RegisterTeamInput): RegisterTeamInput {
  return {
    teamName: formData.teamName.trim(),
    contactEmail: formData.contactEmail.trim().toLowerCase(),
    player1Name: formData.player1Name.trim(),
    player1Email: formData.player1Email.trim().toLowerCase(),
    player2Name: formData.player2Name.trim(),
    player2Email: formData.player2Email.trim().toLowerCase(),
  };
}

export async function registerTeam(
  bracketType: BracketType,
  formData: RegisterTeamInput,
) {
  // Validate bracket type
  if (!["recreational", "competitive"].includes(bracketType)) {
    throw new Error("Invalid bracket type.");
  }

  // Normalize and validate basic input
  const normalized = normalizeInput(formData);

  if (!normalized.teamName || normalized.teamName.length < 2) {
    throw new Error("Please provide a valid team name.");
  }

  if (!normalized.player1Name || !normalized.player2Name) {
    throw new Error("Both player names are required.");
  }

  if (normalized.player1Email === normalized.player2Email) {
    throw new Error("Player emails must be different.");
  }

  // Validate email formats
  const emails = [
    normalized.contactEmail,
    normalized.player1Email,
    normalized.player2Email,
  ];

  for (const email of emails) {
    if (!isValidEmail(email)) {
      throw new Error("Please provide valid email addresses.");
    }
  }

  // verify both players have purchased tickets
  const tickets = await fetchTicketPayments();
  const paidEmails = new Set(tickets.map((t) => t.email));
  const playerEmails = [normalized.player1Email, normalized.player2Email];
  const unpaid = playerEmails.filter((email) => !paidEmails.has(email));

  if (unpaid.length > 0) {
    const ticketUrl = process.env.PARTICIPANT_TICKET_URL ?? "";
    throw new Error(
      `No completed payment found for: ${unpaid.join(", ")}. Each player must purchase a ticket (with your email) before registering. Buy a ticket here: ${ticketUrl}`,
    );
  }

  // Fetch the bracket
  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("id")
    .eq("type", bracketType)
    .single();

  if (bracketError || !bracket) {
    throw new Error("Bracket not found.");
  }

  // Enforce the 32-team cap
  const { count, error: countError } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id)
    .eq("is_active", true);

  if (countError) {
    throw new Error("Could not verify bracket availability.");
  }

  if ((count ?? 0) >= MAX_TEAMS_PER_BRACKET) {
    throw new Error("This bracket is full.");
  }

  // Prevent duplicate registrations by contact email (per bracket)
  const { count: existingTeams, error: existingTeamsError } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id)
    .eq("contact_email", normalized.contactEmail)
    .eq("is_active", true);

  if (existingTeamsError) {
    throw new Error("Could not validate this registration.");
  }

  if ((existingTeams ?? 0) > 0) {
    throw new Error(
      "This email has already registered a team for this bracket.",
    );
  }

  // Create the team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      bracket_id: bracket.id,
      name: normalized.teamName,
      contact_email: normalized.contactEmail,
    })
    .select("id")
    .single();

  if (teamError || !team) {
    throw new Error("Failed to create team.");
  }

  // Create the players
  const { error: playerError } = await supabase.from("players").insert([
    {
      team_id: team.id,
      name: normalized.player1Name,
      email: normalized.player1Email,
    },
    {
      team_id: team.id,
      name: normalized.player2Name,
      email: normalized.player2Email,
    },
  ]);

  // Roll back team if player creation fails
  if (playerError) {
    await supabase.from("teams").delete().eq("id", team.id);
    throw new Error("Failed to create players.");
  }

  // Final capacity revalidation (protects against race conditions)
  const { count: finalCount, error: finalCountError } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id)
    .eq("is_active", true);

  if (finalCountError) {
    throw new Error("Team saved, but availability could not be revalidated.");
  }

  if ((finalCount ?? 0) > MAX_TEAMS_PER_BRACKET) {
    await supabase.from("players").delete().eq("team_id", team.id);
    await supabase.from("teams").delete().eq("id", team.id);
    throw new Error(
      "This bracket filled up while you submitted. Please try another bracket.",
    );
  }

  // Success
  return { success: true, teamId: team.id };
}
