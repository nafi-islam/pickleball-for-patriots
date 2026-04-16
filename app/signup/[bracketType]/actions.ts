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
): Promise<{ success: true; teamId: string } | { error: string }> {
  try {
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

  // Ticket-balance check: for each email associated with this team, compute
  // (tickets purchased) − (players already on active teams). The total
  // available across all team emails must be >= 2. This prevents ticket
  // "theft" while allowing one buyer to cover both players.
  const tickets = await fetchTicketPayments();
  const teamEmailList = [
    normalized.player1Email,
    normalized.player2Email,
    normalized.contactEmail,
  ];
  const uniqueTeamEmails = [...new Set(teamEmailList)];

  // Count tickets purchased per email
  const ticketsByEmail = new Map<string, number>();
  for (const t of tickets) {
    if (uniqueTeamEmails.includes(t.email)) {
      ticketsByEmail.set(t.email, (ticketsByEmail.get(t.email) ?? 0) + 1);
    }
  }

  // Count players already registered on active teams per email
  const { data: activePlayers, error: activePlayersError } = await supabase
    .from("players")
    .select("email, teams!inner(is_active)")
    .in("email", uniqueTeamEmails)
    .eq("teams.is_active", true);

  if (activePlayersError) {
    throw new Error("Could not verify ticket eligibility.");
  }

  const usedByEmail = new Map<string, number>();
  for (const p of activePlayers ?? []) {
    const email = p.email?.trim().toLowerCase();
    if (email) {
      usedByEmail.set(email, (usedByEmail.get(email) ?? 0) + 1);
    }
  }

  let availableTickets = 0;
  for (const email of uniqueTeamEmails) {
    const purchased = ticketsByEmail.get(email) ?? 0;
    const used = usedByEmail.get(email) ?? 0;
    availableTickets += Math.max(0, purchased - used);
  }

  if (availableTickets < 2) {
    const ticketUrl = process.env.PARTICIPANT_TICKET_URL ?? "";
    throw new Error(
      `Not enough available tickets for this team (${availableTickets} available, 2 required). Each ticket can only be used once. Buy tickets here: ${ticketUrl}`,
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
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
