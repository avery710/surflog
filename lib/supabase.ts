/**
 * Server-side Supabase client — used by lib/db.ts and lib/blob.ts only.
 * Never import this from a client component; SUPABASE_SECRET_KEY bypasses
 * Row Level Security entirely (see the sessions table migration under
 * supabase/migrations/) and must never reach the browser.
 *
 * Lazily created (not at module load) so `next build` doesn't fail in an
 * environment that hasn't set these yet — the error only surfaces when a
 * request actually tries to touch the database/storage.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SECRET_KEY are not set — see .env.example"
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
