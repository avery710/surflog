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

// Backoff before each retry, ms. 250+500 (2 retries) wasn't enough: on
// 2026-10-01 the page still 500'd after ~1.5-1.9 s with all three attempts
// rejected, so a skew window can outlast ~1 s. This waits up to ~4 s total.
const SKEW_BACKOFF_MS = [250, 500, 1000, 2000];

/**
 * Supabase's API gateway turns the `sb_secret_` key into a short-lived JWT
 * on every request, and now and then PostgREST/Storage sees that JWT's
 * `iat` a moment ahead of its own clock and rejects it: "JWT issued at
 * future" (hit often in dev, 2026-09-30 — the page 500s from
 * listSessions). It's clock skew between Supabase's own servers (ours
 * matched theirs to the second) and the same request succeeds a moment
 * later, so retry exactly that error, briefly. Anything else passes
 * through untouched.
 */
async function fetchWithSkewRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // A streamed body can only be sent once; everything this app sends
  // (JSON strings, Blobs/Buffers for photo uploads) can be resent.
  const canRetry = !(init?.body instanceof ReadableStream);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init);
    if (res.ok || !canRetry || attempt >= SKEW_BACKOFF_MS.length || ![400, 401, 403].includes(res.status)) return res;
    const text = await res.clone().text();
    if (!text.includes("issued at future")) return res;
    console.warn(`[supabase] "JWT issued at future" (${res.status}), retry ${attempt + 1}/${SKEW_BACKOFF_MS.length}`);
    await new Promise((resolve) => setTimeout(resolve, SKEW_BACKOFF_MS[attempt]));
  }
}

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SECRET_KEY are not set — see .env.example"
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: fetchWithSkewRetry },
  });
  return client;
}
