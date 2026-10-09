/**
 * Pinned spots — Supabase table `spot_pins`
 * (supabase/migrations/20261009100000_create_spot_pins.sql). Each user's own
 * favourites, shown first on /spots. Private per owner. Server-side only.
 *
 * Fails soft like spot reviews: until the migration is applied, the page
 * reads none and writes throw `PinTableMissingError` (→ 503).
 */
import { getSupabase } from "./supabase";
import { isMissingTable } from "./spot-store";

const TABLE = "spot_pins";
export const MIGRATION = "supabase/migrations/20261009100000_create_spot_pins.sql";

/** Pins per user — plenty for favourites, a cap on a runaway client. */
export const MAX_PINS = 50;

export class PinTableMissingError extends Error {
  constructor() {
    super(`The \`${TABLE}\` table doesn't exist yet — apply ${MIGRATION} first.`);
    this.name = "PinTableMissingError";
  }
}

const fail = (e: { code?: string; message: string }) =>
  isMissingTable(e) ? new PinTableMissingError() : new Error(`Supabase: ${e.message}`);

/** The owner's pinned spot slugs, oldest pin first. */
export async function listPins(ownerId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("spot_slug")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });
  if (error) throw fail(error);
  return (data ?? []).map((r) => (r as { spot_slug: string }).spot_slug);
}

/** Pins a spot (pinning twice is a no-op). False when the owner is at MAX_PINS. */
export async function pinSpot(ownerId: string, spotSlug: string): Promise<boolean> {
  const pins = await listPins(ownerId);
  if (pins.includes(spotSlug)) return true;
  if (pins.length >= MAX_PINS) return false;
  const { error } = await getSupabase()
    .from(TABLE)
    .upsert({ owner_id: ownerId, spot_slug: spotSlug }, { onConflict: "owner_id,spot_slug", ignoreDuplicates: true });
  if (error) throw fail(error);
  return true;
}

export async function unpinSpot(ownerId: string, spotSlug: string): Promise<void> {
  const { error } = await getSupabase().from(TABLE).delete().eq("owner_id", ownerId).eq("spot_slug", spotSlug);
  if (error) throw fail(error);
}

/** For the page: a missing table (or any read failure) shows no pins. */
export async function pinsSoftly(ownerId: string): Promise<string[]> {
  try {
    return await listPins(ownerId);
  } catch (e) {
    if (e instanceof PinTableMissingError) console.info("[spot-pins] table missing — migration pending, showing none");
    else console.error("[spot-pins] read failed", e);
    return [];
  }
}
