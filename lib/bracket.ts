type TeamSeed = {
  id: string;
  name: string;
};

export function getNextPowerOfTwo(n: number): number {
  if (n <= 1) return 2;

  let power = 2;
  while (power < n) {
    power *= 2;
  }
  return Math.min(power, 32);
}

export function getRoundCount(bracketSize: number): number {
  return Math.log2(bracketSize);
}

export function buildSlots(teams: TeamSeed[], bracketSize: number) {
  const slots: Array<TeamSeed | null> = [...teams];

  while (slots.length < bracketSize) {
    slots.push(null);
  }

  return slots;
}

export function getRoundOnePairings<T>(slots: Array<T | null>) {
  const pairings: Array<{ teamA: T | null; teamB: T | null }> = [];

  for (let i = 0; i < slots.length; i += 2) {
    pairings.push({
      teamA: slots[i] ?? null,
      teamB: slots[i + 1] ?? null,
    });
  }

  return pairings;
}

// Prefer bye distribution so we avoid null-vs-null matches in round 1.
export function buildRoundOnePairings(
  teams: TeamSeed[],
  bracketSize: number,
) {
  const byes = Math.max(0, bracketSize - teams.length);
  const pairings: Array<{ teamA: TeamSeed | null; teamB: TeamSeed | null }> = [];

  // Give byes to the earliest seeds (deterministic, MVP-friendly).
  for (let i = 0; i < byes; i++) {
    pairings.push({ teamA: teams[i] ?? null, teamB: null });
  }

  // Pair remaining teams from the outside in: high vs low seed.
  let left = byes;
  let right = teams.length - 1;

  while (left <= right) {
    if (left === right) {
      pairings.push({ teamA: teams[left] ?? null, teamB: null });
      break;
    }
    pairings.push({ teamA: teams[left] ?? null, teamB: teams[right] ?? null });
    left += 1;
    right -= 1;
  }

  return pairings;
}

export function getNextMatchIndex(indexInRound: number) {
  return Math.ceil(indexInRound / 2);
}

export function getNextMatchSlot(
  indexInRound: number,
): "team_a_id" | "team_b_id" {
  return indexInRound % 2 === 1 ? "team_a_id" : "team_b_id";
}
