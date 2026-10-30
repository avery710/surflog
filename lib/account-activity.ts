/**
 * Account activity — Supabase table `account_activity`
 * (supabase/migrations/20261028000000_create_account_activity.sql), SURFLOG-33.
 * One row per owner per day they opened the signed-in journal; their first day
 * is their sign-up day. Counts only: no email, no name. Server-side only.
 *
 * Recording never throws and never blocks a page: until the migration is
 * applied (or if the database hiccups) the journal just doesn't count that
 * visit.
 */
import { getSupabase } from "./supabase";

const TABLE = "account_activity";

/** Today's date in Asia/Taipei as YYYY-MM-DD, like the activity calendar. */
export function taipeiDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(now);
}

// "owner:day" pairs already written by this instance, so a busy user costs one
// write a day per instance rather than one per page load. Emptied when the
// day rolls over.
const written = new Set<string>();
let writtenDay = "";

/** Marks the owner active today. Safe to call on every page load. */
export async function recordActivity(ownerId: string, now: Date = new Date()): Promise<void> {
  const day = taipeiDay(now);
  if (day !== writtenDay) {
    written.clear();
    writtenDay = day;
  }
  const key = `${ownerId}:${day}`;
  if (written.has(key)) return;
  written.add(key);
  try {
    const { error } = await getSupabase()
      .from(TABLE)
      .upsert({ owner_id: ownerId, day }, { onConflict: "owner_id,day", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  } catch (e) {
    written.delete(key); // try again on the next visit
    console.warn(`[account-activity] not recorded: ${e instanceof Error ? e.message : e}`);
  }
}

export type ActivityDay = { day: string; active: number; new: number };

export type ActivityStats = {
  /** Everyone who has ever been counted. */
  total: number;
  active7: number;
  active30: number;
  new7: number;
  new30: number;
  /** The last 30 days, oldest first; today is the last entry. */
  daily: ActivityDay[];
};

/** For /admin. Null when the migration isn't applied or the read fails. */
export async function getActivityStats(now: Date = new Date()): Promise<ActivityStats | null> {
  const { data, error } = await getSupabase().rpc("account_activity_stats", { p_today: taipeiDay(now) });
  if (error || !data) return null;
  return data as ActivityStats;
}
