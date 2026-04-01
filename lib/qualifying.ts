export const QUALIFYING_MATCH_ORDER: Array<[number, number]> = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

type TeamSeed = {
  id: string;
  name: string;
};

export function buildRoundRobinMatches(teams: TeamSeed[]) {
  if (teams.length !== 4) {
    throw new Error("Qualifying courts must have exactly 4 teams.");
  }

  return QUALIFYING_MATCH_ORDER.map(([a, b], idx) => ({
    match_index: idx + 1,
    team_a_id: teams[a].id,
    team_b_id: teams[b].id,
  }));
}

export type QualifyingStat = {
  team_id: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  differential: number;
};

export function computeStats(
  teams: TeamSeed[],
  matches: Array<{
    team_a_id: string;
    team_b_id: string;
    score_a: number | null;
    score_b: number | null;
    status: string | null;
  }>,
) {
  const stats = new Map<string, QualifyingStat>();

  for (const team of teams) {
    stats.set(team.id, {
      team_id: team.id,
      wins: 0,
      losses: 0,
      points_for: 0,
      points_against: 0,
      differential: 0,
    });
  }

  for (const match of matches) {
    if (
      match.status !== "COMPLETED" ||
      match.score_a == null ||
      match.score_b == null
    ) {
      continue;
    }

    const teamA = stats.get(match.team_a_id);
    const teamB = stats.get(match.team_b_id);

    if (!teamA || !teamB) {
      continue;
    }

    teamA.points_for += match.score_a;
    teamA.points_against += match.score_b;
    teamB.points_for += match.score_b;
    teamB.points_against += match.score_a;

    if (match.score_a > match.score_b) {
      teamA.wins += 1;
      teamB.losses += 1;
    } else if (match.score_b > match.score_a) {
      teamB.wins += 1;
      teamA.losses += 1;
    }
  }

  for (const entry of stats.values()) {
    entry.differential = entry.points_for - entry.points_against;
  }

  return Array.from(stats.values());
}

export function rankTeams(stats: QualifyingStat[]) {
  return [...stats].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.differential !== a.differential) return b.differential - a.differential;
    return b.points_for - a.points_for;
  });
}
