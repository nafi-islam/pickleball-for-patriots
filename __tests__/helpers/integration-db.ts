import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getSupabaseUrl(): string {
  const url =
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "integration-db: missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL (ensure .env is loaded).",
    );
  }
  return url;
}

function getServiceRoleKey(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!key) {
    throw new Error(
      "integration-db: missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY.",
    );
  }
  return key;
}

let _client: SupabaseClient | null = null;

function getTestDb(): SupabaseClient {
  if (!_client) {
    _client = createClient(getSupabaseUrl(), getServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/** Lazy client so env is read after Vitest merges `.env` into `process.env`. */
export const testDb = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return Reflect.get(getTestDb(), prop);
  },
}) as SupabaseClient;

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Insert a tournament and brackets. Returns an object mapping bracket type
 * strings to their UUIDs.
 *
 * @example
 * const { brackets } = await seedBrackets();
 * // brackets.recreational  → "uuid-..."
 * // brackets.competitive   → "uuid-..."
 */
export async function seedBrackets(
  types: string[] = ["recreational", "competitive"],
) {
  const { data: tournament, error: tErr } = await testDb
    .from("tournaments")
    .insert({ name: "Integration Test Tournament", status: "REGISTRATION" })
    .select("id")
    .single();

  if (tErr || !tournament)
    throw new Error(`seedBrackets: tournament insert failed – ${tErr?.message}`);

  const rows = types.map((type) => ({
    tournament_id: tournament.id,
    type,
    status: "DRAFT",
  }));

  const { data: brackets, error: bErr } = await testDb
    .from("brackets")
    .insert(rows)
    .select("id, type");

  if (bErr || !brackets)
    throw new Error(`seedBrackets: brackets insert failed – ${bErr?.message}`);

  const map: Record<string, string> = {};
  for (const b of brackets) map[b.type as string] = b.id as string;

  return { tournamentId: tournament.id as string, brackets: map };
}

/**
 * Bulk-insert `count` active teams into a bracket. Useful for filling a
 * bracket to capacity in tests.
 */
export async function seedTeams(bracketId: string, count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    bracket_id: bracketId,
    name: `Seed Team ${i + 1}`,
    contact_email: `seed-team-${i + 1}@test.com`,
    is_active: true,
  }));

  const { error } = await testDb.from("teams").insert(rows);
  if (error)
    throw new Error(`seedTeams: insert of ${count} teams failed – ${error.message}`);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

const NEVER_MATCHES = "00000000-0000-0000-0000-000000000000";

/**
 * Delete all rows from every table touched by integration tests. Deletes in
 * reverse foreign-key order so constraints are satisfied.
 */
export async function cleanupTestData() {
  await testDb.from("qualifying_team_stats").delete().neq("team_id", NEVER_MATCHES);
  await testDb.from("qualifying_matches").delete().neq("id", NEVER_MATCHES);
  await testDb.from("qualifying_assignments").delete().neq("id", NEVER_MATCHES);
  await testDb.from("qualifying_courts").delete().neq("id", NEVER_MATCHES);
  await testDb.from("matches").delete().neq("id", NEVER_MATCHES);
  await testDb.from("players").delete().neq("id", NEVER_MATCHES);
  await testDb.from("teams").delete().neq("id", NEVER_MATCHES);
  await testDb.from("brackets").delete().neq("id", NEVER_MATCHES);
  await testDb.from("tournaments").delete().neq("id", NEVER_MATCHES);
}
