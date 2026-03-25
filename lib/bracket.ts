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

export function getNextMatchIndex(indexInRound: number) {
  return Math.ceil(indexInRound / 2);
}

export function getNextMatchSlot(
  indexInRound: number,
): "team_a_id" | "team_b_id" {
  return indexInRound % 2 === 1 ? "team_a_id" : "team_b_id";
}
