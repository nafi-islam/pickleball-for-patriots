import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing Supabase URL. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.",
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "Missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY.",
  );
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
