/**
 * The spot catalogue — Supabase table `spots`
 * (supabase/migrations/20261005000000_create_spots_table.sql). Server-side
 * only, like lib/db.ts. One list for everything: the 41 Taiwan breaks
 * (Swelleye infographic + CWA township), Siargao, Bali and whatever the admin
 * adds. Everyone signed in reads it; only the admin(s) in SPOT_ADMIN_EMAILS
 * (lib/spot-admin.ts) change it. Journals stay private as ever.
 *
 * `created_by` is an audit column (null for seeds) and never leaves this
 * file: `rowToSpot` doesn't copy it.
 */
import { cache } from "react";
import { getSupabase } from "./supabase";
import { isRequestSlug, type Region, type Spot } from "./spots";

const TABLE = "spots";

export interface SpotRow {
  slug: string;
  name: string;
  name_zh: string | null;
  region: Region | null;
  country: string;
  area: string;
  lat: number;
  lng: number;
  timezone: string;
  facing: string | null;
  best_swell_dir: string[] | null;
  best_wind_dir: string[] | null;
  best_tide: string | null;
  tide_township: string | null;
  created_by: string | null;
  created_at: string;
}

/** What an admin supplies; `slug`, `created_by`, `timezone` are decided server-side. */
export interface SpotInput {
  name: string;
  nameZh: string | null;
  region: Region | null;
  country: string;
  area: string;
  lat: number;
  lng: number;
  timezone: string;
  facing: string | null;
  bestSwellDir: string[] | null;
  bestWindDir: string[] | null;
  bestTide: string | null;
  tideTownship: string | null;
}

export function rowToSpot(row: SpotRow): Spot {
  return {
    slug: row.slug,
    name: row.name,
    ...(row.name_zh ? { nameZh: row.name_zh } : {}),
    ...(row.region ? { region: row.region } : {}),
    country: row.country,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
    timezone: row.timezone,
    ...(row.facing ? { facing: row.facing } : {}),
    ...(row.best_swell_dir?.length ? { bestSwellDir: row.best_swell_dir } : {}),
    ...(row.best_wind_dir?.length ? { bestWindDir: row.best_wind_dir } : {}),
    ...(row.best_tide ? { bestTide: row.best_tide } : {}),
    ...(row.tide_township ? { tideTownship: row.tide_township } : {}),
  };
}

/** PostgREST says PGRST205 for a table missing from its schema cache, and
 *  Postgres 42P01 for an undefined relation. Both mean "migration not
 *  applied yet" — anything else is a real failure and must still throw. */
export function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

const MISSING_MESSAGE =
  "The `spots` table doesn't exist yet — apply supabase/migrations/20261005000000_create_spots_table.sql first.";

/** Every spot, Taiwan first then by name. Deduped per server render with
 *  React's cache(), so a page asking twice costs one query. */
export const listSpots = cache(async (): Promise<Spot[]> => {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: true })
    .order("slug", { ascending: true });
  if (error) throw new Error(`Supabase: ${error.message}`);
  return ((data ?? []) as SpotRow[]).map(rowToSpot);
});

export async function getSpotRow(slug: string): Promise<SpotRow | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data as SpotRow | null) ?? null;
}

/** One spot by slug — a single-row query (no list load) for the hot
 *  session paths. `req:` and `custom:` slugs have no spot, so no query. */
export async function resolveSpot(slug: string): Promise<Spot | undefined> {
  if (!slug || slug.includes(":") || isRequestSlug(slug)) return undefined;
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data ? rowToSpot(data as SpotRow) : undefined;
}

const toColumns = (input: SpotInput) => ({
  name: input.name,
  name_zh: input.nameZh,
  region: input.region,
  country: input.country,
  area: input.area,
  lat: input.lat,
  lng: input.lng,
  timezone: input.timezone,
  facing: input.facing,
  best_swell_dir: input.bestSwellDir,
  best_wind_dir: input.bestWindDir,
  best_tide: input.bestTide,
  tide_township: input.tideTownship,
});

function failure(error: { code?: string; message: string }): Error {
  return new Error(isMissingTable(error) ? MISSING_MESSAGE : `Supabase: ${error.message}`);
}

/** Returns the new row, or "conflict" if the slug was taken in the meantime. */
export async function insertSpot(slug: string, input: SpotInput, createdBy: string): Promise<SpotRow | "conflict"> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert({ slug, ...toColumns(input), created_by: createdBy })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return "conflict";
    throw failure(error);
  }
  return data as SpotRow;
}

export async function updateSpot(slug: string, input: SpotInput): Promise<SpotRow | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(toColumns(input))
    .eq("slug", slug)
    .select("*")
    .maybeSingle();
  if (error) throw failure(error);
  return (data as SpotRow | null) ?? null;
}

export async function deleteSpot(slug: string): Promise<boolean> {
  const { data, error } = await getSupabase().from(TABLE).delete().eq("slug", slug).select("slug");
  if (error) throw failure(error);
  return (data?.length ?? 0) > 0;
}

/** Any owner's sessions at this spot — a spot someone has logged a session
 *  at can't be deleted out from under them. Says only whether there is one,
 *  never whose. */
export async function spotInUse(slug: string): Promise<boolean> {
  const { data, error } = await getSupabase().from("sessions").select("id").eq("spot", slug).limit(1);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
