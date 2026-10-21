import { getSupabase } from "@/lib/supabase";

/** Each environment's health check (app/api/health/route.ts on that deploy),
 *  called daily from production by app/api/cron/keep-awake/route.ts. */
export const HEALTH_CHECK_URLS = {
  production: "https://surflog.tw/api/health",
  staging: "https://stag-wipeout.surflog.tw/api/health",
} as const;

/** One tiny read against this deployment's Supabase project, so the call
 *  counts as database activity (a free-tier project pauses after a week
 *  without any). Throws on failure. Used by /api/health. */
export async function pingDatabase(): Promise<void> {
  const { error } = await getSupabase().from("spots").select("slug").limit(1);
  if (error) throw new Error(error.message);
}
