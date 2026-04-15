import { supabase } from "@/lib/supabase";
import { HomePageClient } from "@/components/HomePageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_TEAMS_PER_BRACKET = 32;

type BracketType = "recreational" | "competitive";

type BracketAvailability = {
  type: BracketType;
  registeredTeams: number;
  spotsLeft: number;
};

async function getBracketAvailability(): Promise<BracketAvailability[]> {
  const { data: brackets, error: bracketsError } = await supabase
    .from("brackets")
    .select("id, type")
    .in("type", ["recreational", "competitive"]);

  if (bracketsError || !brackets) {
    return [
      {
        type: "recreational",
        registeredTeams: 0,
        spotsLeft: MAX_TEAMS_PER_BRACKET,
      },
      {
        type: "competitive",
        registeredTeams: 0,
        spotsLeft: MAX_TEAMS_PER_BRACKET,
      },
    ];
  }

  const counts = await Promise.all(
    (["recreational", "competitive"] as const).map(async (type) => {
      const bracket = brackets.find((entry) => entry.type === type);

      if (!bracket) {
        return {
          type,
          registeredTeams: 0,
          spotsLeft: MAX_TEAMS_PER_BRACKET,
        };
      }

      const { count } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("bracket_id", bracket.id)
        .eq("is_active", true);

      const registeredTeams = count ?? 0;

      return {
        type,
        registeredTeams,
        spotsLeft: Math.max(0, MAX_TEAMS_PER_BRACKET - registeredTeams),
      };
    }),
  );

  return counts;
}

export default async function HomePage() {
  const bracketAvailability = await getBracketAvailability();

  return <HomePageClient bracketAvailability={bracketAvailability} />;
}
